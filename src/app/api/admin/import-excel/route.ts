import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Next.js 15: cookies() is async */
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
  const isAdmin =
    !!user?.user_metadata?.is_admin ||
    (Array.isArray(user?.app_metadata?.roles) && user!.app_metadata!.roles.includes("admin"));
  if (!user || !isAdmin) throw new Error("Not authorized");
  return { supabase, userId: user.id };
}

/* ---------- utils ---------- */
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
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString()
    .slice(0, 10);
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

export async function POST(req: NextRequest) {
  try {
    const { supabase, userId } = await requireAdmin();
    const form = await req.formData();
    const files: File[] = [
      ...form.getAll("files").filter((f): f is File => f instanceof File),
      ...form.getAll("file").filter((f): f is File => f instanceof File),
    ];
    if (!files.length) {
      return NextResponse.json({ error: "Upload one or more .xlsx files as 'files' (or 'file')." }, { status: 400 });
    }

    // Import batch (fields casted as any so missing columns won't break)
    const filenames = files.map((f) => (f as any).name || "upload.xlsx").join(", ");
    const { data: batch } = await supabase
      .from("import_batches")
      .insert({ uploaded_by: userId, filename: filenames, row_count: 0, status: "parsing" } as any)
      .select("*")
      .single();

    let totalInserted = 0;
    let totalEventsUpserted = 0;
    const tournamentsTouched = new Set<string>();

    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: "buffer", cellDates: true, raw: false });
      const tpSheet = wb.Sheets["TotalPoints"];
      if (!tpSheet) continue;

      const tpRows = XLSX.utils.sheet_to_json<RowTP>(tpSheet, { defval: null });

      /* ----------- Build sets in memory (NO per-row calls) ----------- */
      const eventsMap = new Map<
        string,
        { id: string; name: string | null; start_date: string | null; buy_in_raw: string | null; site_name: string | null }
      >();
      const playersMap = new Map<string, { id: string; forename: string | null; surname: string | null; display_name: string | null }>();
      const aliasesSet = new Set<string>(); // key: playerId|lower(fullname)
      const resultsRows: any[] = [];

      for (const r of tpRows) {
        const playerId = r["Player Id"] != null ? String(r["Player Id"]).trim() : "";
        const forename = r.Forename != null ? String(r.Forename).trim() : "";
        const surname = r.Surname != null ? String(r.Surname).trim() : "";
        const fullName = r["Full Name"] != null ? String(r["Full Name"]).trim() : "";
        const tournamentId = r["Tournament Id"] != null ? String(r["Tournament Id"]).trim() : "";

        const name = r["Tournament Name"] != null ? String(r["Tournament Name"]).trim() : null;
        const start_date = toDateYYYYMMDD(r["Start Date"]);
        const buy_in_raw =
          r["Buy In"] !== null && r["Buy In"] !== undefined && String(r["Buy In"]).trim() !== ""
            ? String(r["Buy In"]).trim()
            : null;
        const site_name =
          r.Casino !== null && r.Casino !== undefined && String(r.Casino).trim() !== ""
            ? String(r.Casino).trim()
            : null;

        if (tournamentId) {
          eventsMap.set(tournamentId, { id: tournamentId, name, start_date, buy_in_raw, site_name });
          tournamentsTouched.add(tournamentId);
        }
        if (playerId) {
          // keep the latest name we see
          playersMap.set(playerId, {
            id: playerId,
            forename: forename || null,
            surname: surname || null,
            display_name: fullName || null,
          });
          if (fullName) aliasesSet.add(`${playerId}|${fullName.toLowerCase()}`);
        }

        const points = toNum(r.Points);
        const prize = toNum(r["Prize Amount"]);
        const posPrize = toNum(r["Position Of Prize"]);
        const gdpr = toBool(r.GDPR);

        if (playerId || tournamentId) {
          resultsRows.push({
            player_id: playerId || null,
            event_id: tournamentId || null,
            points,
            prize_amount: prize,
            position_of_prize: posPrize,
            gdpr_flag: gdpr,
            import_batch_id: batch?.id ?? null,
          });
        }
      }
      /* ---------------------------------------------------------------- */

      /* Upsert events (chunked) */
      const eventArr = Array.from(eventsMap.values());
      totalEventsUpserted += eventArr.length;
      for (const slice of chunk(eventArr, 2000)) {
        const payload = slice.map((e) => ({
          id: e.id,
          name: e.name,
          start_date: e.start_date, // DATE 'YYYY-MM-DD'
          buy_in_raw: e.buy_in_raw, // TEXT
          site_name: e.site_name,   // TEXT
        }));
        const { error: evErr } = await supabase.from("events").upsert(payload as any, { onConflict: "id" });
        if (evErr) throw new Error(`Events upsert failed: ${evErr.message}`);
      }

      /* Delete old results for these tournaments (idempotent) */
      if (tournamentsTouched.size) {
        for (const slice of chunk(Array.from(tournamentsTouched), 2000)) {
          const { error: delErr } = await supabase.from("results").delete().in("event_id", slice);
          if (delErr) throw new Error(`Delete existing results failed: ${delErr.message}`);
        }
      }

      /* Bulk upsert players */
      const playersArr = Array.from(playersMap.values()).map((p) => ({
        id: p.id,
        forename: p.forename,
        surname: p.surname,
        display_name: p.display_name,
      }));
      for (const slice of chunk(playersArr, 2000)) {
        const { error: pErr } = await supabase.from("players").upsert(slice as any, { onConflict: "id" });
        if (pErr) throw new Error(`Players upsert failed: ${pErr.message}`);
      }

      /* Bulk insert aliases (ignore duplicates via unique index) */
      if (aliasesSet.size) {
        const aliasRows = Array.from(aliasesSet).map((key) => {
          const [player_id, aliasLower] = key.split("|");
          return { player_id, alias: aliasLower }; // store lower; or store original if you prefer
        });
        // If you prefer to store the original case, keep a second map; using lower keeps it normalized.
        for (const slice of chunk(aliasRows, 2000)) {
          const { error: aErr } = await supabase
            .from("player_aliases")
            // upsert works only if you have a real PK; for unique index use insert + ignore duplicates on server
            .upsert(slice as any, { onConflict: "player_id,alias" });
          if (aErr) throw new Error(`Aliases insert failed: ${aErr.message}`);
        }
      }

      /* Bulk insert results */
      for (const slice of chunk(resultsRows, 2000)) {
        const { error: rErr } = await supabase.from("results").insert(slice);
        if (rErr) throw new Error(`Results insert failed: ${rErr.message}`);
        totalInserted += slice.length;
      }
    }

    // Mark batch done
    await supabase
      .from("import_batches")
      .update({ status: "normalized", processed_count: totalInserted } as any)
      .eq("id", batch?.id);

    return NextResponse.json({
      ok: true,
      events_upserted: totalEventsUpserted,
      results_inserted: totalInserted,
      tournaments_replaced: Array.from(tournamentsTouched).length,
      batch_id: batch?.id ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Import failed" }, { status: 500 });
  }
}
