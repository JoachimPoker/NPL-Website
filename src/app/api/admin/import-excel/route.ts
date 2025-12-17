import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { takeLeaderboardSnapshot } from "@/lib/leaderboardUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* --- Helpers --- */
async function getSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
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
}

async function requireAdmin(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const isAdmin = !!user?.user_metadata?.is_admin || (Array.isArray(user?.app_metadata?.roles) && user!.app_metadata!.roles.includes("admin"));
  if (!user || !isAdmin) throw new Error("Not authorized");
  return { supabase, userId: user.id };
}

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

type RowTP = {
  "Player Id"?: string | number;
  Forename?: string;
  Surname?: string;
  "Full Name"?: string;
  "Tournament Id"?: string | number;
  "Tournament Name"?: string;
  "Start Date"?: string | Date;
  "Buy In"?: string | number;
  Casino?: string;
  GDPR?: string | number | boolean;
  Points?: string | number;
  "Prize Amount"?: string | number;
  "Position Of Prize"?: string | number;
};

/* --- Main Handler --- */
export async function POST(req: NextRequest) {
  try {
    const { supabase, userId } = await requireAdmin();
    const form = await req.formData();
    
    // 1. Get Date (Default to Today if blank)
    const rawDate = form.get("snapshotDate") as string | null;
    const snapshotDate = rawDate || new Date().toISOString().split('T')[0];

    const files: File[] = [
      ...form.getAll("files").filter((f): f is File => f instanceof File),
      ...form.getAll("file").filter((f): f is File => f instanceof File),
    ];
    if (!files.length) return NextResponse.json({ error: "No files uploaded." }, { status: 400 });

    // 2. Create Batch Record (Saving snapshot_date)
    const filenames = files.map((f) => (f as any).name || "upload.xlsx").join(", ");
    const { data: batch } = await supabase
      .from("import_batches")
      .insert({ 
        uploaded_by: userId, 
        filename: filenames, 
        row_count: 0, 
        status: "parsing",
        snapshot_date: snapshotDate // <--- Saving the date to DB
      } as any)
      .select("*")
      .single();

    let totalInserted = 0;
    let totalEventsUpserted = 0;
    const tournamentsTouched = new Set<string>();

    // 3. Process Files
    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: "buffer", cellDates: true, raw: false });
      const tpSheet = wb.Sheets["TotalPoints"];
      if (!tpSheet) continue;

      const tpRows = XLSX.utils.sheet_to_json<RowTP>(tpSheet, { defval: null });

      const eventsMap = new Map<string, any>();
      const playersMap = new Map<string, any>();
      const aliasesSet = new Set<string>();
      const resultsRows: any[] = [];

      for (const r of tpRows) {
        const playerId = r["Player Id"] != null ? String(r["Player Id"]).trim() : "";
        const fullName = r["Full Name"] != null ? String(r["Full Name"]).trim() : "";
        const tournamentId = r["Tournament Id"] != null ? String(r["Tournament Id"]).trim() : "";
        
        if (tournamentId) {
          eventsMap.set(tournamentId, {
             id: tournamentId, 
             name: r["Tournament Name"], 
             start_date: toDateYYYYMMDD(r["Start Date"]), 
             buy_in_raw: r["Buy In"], 
             site_name: r.Casino 
          });
          tournamentsTouched.add(tournamentId);
        }
        if (playerId) {
          playersMap.set(playerId, {
            id: playerId,
            forename: r.Forename,
            surname: r.Surname,
            display_name: fullName,
          });
          if (fullName) aliasesSet.add(`${playerId}|${fullName.toLowerCase()}`);
        }

        if (playerId || tournamentId) {
          resultsRows.push({
            player_id: playerId || null,
            event_id: tournamentId || null,
            points: toNum(r.Points),
            prize_amount: toNum(r["Prize Amount"]),
            position_of_prize: toNum(r["Position Of Prize"]),
            gdpr_flag: toBool(r.GDPR),
            import_batch_id: batch?.id ?? null,
          });
        }
      }

      /* Upsert Events */
      const eventArr = Array.from(eventsMap.values());
      totalEventsUpserted += eventArr.length;
      for (const slice of chunk(eventArr, 2000)) {
         await supabase.from("events").upsert(slice as any, { onConflict: "id" });
      }

      /* Clear Old Results */
      if (tournamentsTouched.size) {
        for (const slice of chunk(Array.from(tournamentsTouched), 2000)) {
           await supabase.from("results").delete().in("event_id", slice);
        }
      }

      /* Upsert Players */
      const playersArr = Array.from(playersMap.values());
      for (const slice of chunk(playersArr, 2000)) {
         await supabase.from("players").upsert(slice as any, { onConflict: "id" });
      }

      /* Upsert Aliases */
      if (aliasesSet.size) {
        const aliasRows = Array.from(aliasesSet).map(k => ({ player_id: k.split("|")[0], alias: k.split("|")[1] }));
        for (const slice of chunk(aliasRows, 2000)) {
           await supabase.from("player_aliases").upsert(slice as any, { onConflict: "player_id,alias" });
        }
      }

      /* Insert Results */
      for (const slice of chunk(resultsRows, 2000)) {
        await supabase.from("results").insert(slice);
        totalInserted += slice.length;
      }
    }

    // Mark batch done
    await supabase.from("import_batches").update({ status: "normalized", processed_count: totalInserted } as any).eq("id", batch?.id);

    // 4. ✅ SNAPSHOT AFTER IMPORT
    try {
      console.log(`📸 Taking Post-Import Snapshot (Date: ${snapshotDate})...`);
      await takeLeaderboardSnapshot(supabase, snapshotDate);
    } catch (snapErr) {
      console.error("Auto-snapshot failed:", snapErr);
    }

    return NextResponse.json({
      ok: true,
      events_upserted: totalEventsUpserted,
      results_inserted: totalInserted,
      batch_id: batch?.id ?? null,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "Import failed" }, { status: 500 });
  }
}