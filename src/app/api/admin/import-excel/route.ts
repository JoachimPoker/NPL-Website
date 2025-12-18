import { NextRequest, NextResponse } from "next/server";
// Library for parsing Excel files with sheet name detection
import readXlsxFile, { readSheetNames } from "read-excel-file/node"; 
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { takeLeaderboardSnapshot } from "@/lib/leaderboardUtils";
// Import the Admin Client to bypass Row-Level Security (RLS)
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* --- Missing Helper: requireAdmin --- */
/**
 * Authentication helper to ensure the user is an admin.
 */
async function requireAdmin(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  );

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  
  // Check admin metadata or roles
  const isAdmin = !!user?.user_metadata?.is_admin || 
                  (Array.isArray(user?.app_metadata?.roles) && user!.app_metadata!.roles.includes("admin"));

  if (!user || !isAdmin) throw new Error("Not authorized");
  return { supabase, userId: user.id };
}

/* --- Utility Helpers --- */
function toBool(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[,£$]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toDateYYYYMMDD(x: unknown): string | null {
  if (!x) return null;
  const d = new Date(x as any);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* --- Main Handler --- */
export async function POST(req: NextRequest) {
  try {
    console.log("Starting Import Process...");
    
    // 1. Auth Check & Admin Client Init
    const { userId } = await requireAdmin();
    const adminSupabase = createSupabaseAdminClient(); // Critical: Bypasses RLS
    
    const form = await req.formData();
    const rawDate = form.get("snapshotDate") as string | null;
    const snapshotDate = rawDate || new Date().toISOString().split('T')[0];

    const files: File[] = [
      ...form.getAll("files").filter((f): f is File => f instanceof File),
      ...form.getAll("file").filter((f): f is File => f instanceof File),
    ];
    if (!files.length) return NextResponse.json({ error: "No files uploaded." }, { status: 400 });

    // 2. Create Batch Record
    const filenames = files.map((f) => f.name || "upload.xlsx").join(", ");
    const { data: batch, error: batchErr } = await adminSupabase
      .from("import_batches")
      .insert({ 
        uploaded_by: userId, 
        filename: filenames, 
        row_count: 0, 
        status: "parsing",
        snapshot_date: snapshotDate
      })
      .select("*")
      .single();

    if (batchErr) throw new Error(`Batch creation failed: ${batchErr.message}`);

    let totalInserted = 0;
    let totalEventsUpserted = 0;
    const tournamentsTouched = new Set<string>();

    // 3. Process Files
    for (const file of files) {
      console.log(`Reading file: ${file.name}`);
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Case-insensitive sheet detection to prevent "0 events" error
      const sheetNames = await readSheetNames(buffer);
      const targetSheet = sheetNames.find(s => 
        ["TotalPoints", "totalpoints", "TOTALPOINTS", "Total Points"].includes(s.trim())
      );

      if (!targetSheet) {
        console.warn(`Required sheet not found in ${file.name}. Found: ${sheetNames.join(", ")}`);
        continue;
      }

      const rows = await readXlsxFile(buffer, { sheet: targetSheet });
      if (!rows || rows.length <= 1) continue;

      const headers = rows[0].map((h: any) => String(h).trim());
      const dataRows = rows.slice(1);

      const eventsMap = new Map<string, any>();
      const playersMap = new Map<string, any>();
      const aliasesSet = new Set<string>();
      const resultsRows: any[] = [];

      const getValue = (row: any[], headerName: string) => {
        const index = headers.indexOf(headerName);
        return index !== -1 ? row[index] : null;
      };

      for (const r of dataRows) {
        const playerId = String(getValue(r, "Player Id") || "").trim();
        const tournamentId = String(getValue(r, "Tournament Id") || "").trim();
        const fullName = String(getValue(r, "Full Name") || "").trim();
        
        if (tournamentId) {
          eventsMap.set(tournamentId, {
             id: tournamentId, 
             name: getValue(r, "Tournament Name"), 
             start_date: toDateYYYYMMDD(getValue(r, "Start Date")), 
             buy_in_raw: getValue(r, "Buy In"), 
             site_name: getValue(r, "Casino") 
          });
          tournamentsTouched.add(tournamentId);
        }

        if (playerId) {
          playersMap.set(playerId, {
            id: playerId,
            forename: getValue(r, "Forename"),
            surname: getValue(r, "Surname"),
            display_name: fullName,
          });
          if (fullName) aliasesSet.add(`${playerId}|${fullName.toLowerCase()}`);
        }

        if (playerId || tournamentId) {
          resultsRows.push({
            player_id: playerId || null,
            event_id: tournamentId || null,
            points: toNum(getValue(r, "Points")),
            prize_amount: toNum(getValue(r, "Prize Amount")),
            position_of_prize: toNum(getValue(r, "Position Of Prize")),
            gdpr_flag: toBool(getValue(r, "GDPR")),
            import_batch_id: batch.id,
          });
        }
      }

      // 4. Save to Database using Admin Client
      if (eventsMap.size > 0) {
        const eventArr = Array.from(eventsMap.values());
        totalEventsUpserted += eventArr.length;
        for (const slice of chunk(eventArr, 1000)) {
           await adminSupabase.from("events").upsert(slice, { onConflict: "id" });
        }
      }

      // Clear existing results for these tournaments to avoid duplicates
      if (tournamentsTouched.size > 0) {
        for (const slice of chunk(Array.from(tournamentsTouched), 1000)) {
           await adminSupabase.from("results").delete().in("event_id", slice);
        }
      }

      if (playersMap.size > 0) {
        for (const slice of chunk(Array.from(playersMap.values()), 1000)) {
           await adminSupabase.from("players").upsert(slice, { onConflict: "id" });
        }
      }

      if (aliasesSet.size > 0) {
        const aliasRows = Array.from(aliasesSet).map(k => ({ 
          player_id: k.split("|")[0], 
          alias: k.split("|")[1] 
        }));
        for (const slice of chunk(aliasRows, 1000)) {
           await adminSupabase.from("player_aliases").upsert(slice, { onConflict: "player_id,alias" });
        }
      }

      for (const slice of chunk(resultsRows, 1000)) {
        const { error: insErr } = await adminSupabase.from("results").insert(slice);
        if (insErr) throw insErr;
        totalInserted += slice.length;
      }
    }

    // Mark batch done
    await adminSupabase.from("import_batches").update({ status: "normalized", row_count: totalInserted }).eq("id", batch.id);

    // 5. Post-Import Snapshot (Using Admin Client)
    try {
      console.log(`📸 Taking Post-Import Snapshot (Date: ${snapshotDate})...`);
      await takeLeaderboardSnapshot(adminSupabase, snapshotDate);
    } catch (snapErr) {
      console.error("Auto-snapshot failed:", snapErr);
    }

    return NextResponse.json({
      ok: true,
      events_upserted: totalEventsUpserted,
      results_inserted: totalInserted,
      batch_id: batch.id,
    });

  } catch (e: any) {
    console.error("IMPORT ERROR:", e.message);
    return NextResponse.json({ error: e.message || "Import failed" }, { status: 500 });
  }
}