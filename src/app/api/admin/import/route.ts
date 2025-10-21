// src/app/api/admin/import/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import * as XLSX from "xlsx";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 300; // allow long batch runs

// =======================
// Types
// =======================
type ResultBase = {
  player_id: string;
  event_id: string;
  start_date: string; // YYYY-MM-DD
  points: number;
  position_of_prize: number | null;
  prize_amount: number | null;
  gdpr_flag: boolean;
  tournament_name: string | null;
  casino: string | null;
  buy_in_raw: string | null;
  web_sync_site_id: string | null;
  is_deleted: boolean;
};

type ResultPayload = ResultBase & {
  raw_hash: string;
  import_batch_id: string;
};

type ExistingResult = {
  id: string;
  player_id: string;
  event_id: string;
  raw_hash: string | null;
  is_deleted: boolean;
};

// =======================
// Helpers
// =======================
const CHUNK = 1000;

function normStr(x: any): string | null {
  if (x === null || x === undefined) return null;
  const s = String(x).trim();
  return s === "" ? null : s;
}

/**
 * Convert an Excel cell to YYYY-MM-DD
 * - If number: treat as Excel serial (epoch 1899-12-30)
 * - If string/Date: use new Date and slice(0,10)
 */
function toDateOnly(x: any): string | null {
  if (x === null || x === undefined || x === "") return null;

  if (typeof x === "number" && Number.isFinite(x)) {
    const epochMs = Date.UTC(1899, 11, 30); // 1899-12-30
    const ms = Math.round(x * 86400000);
    const d = new Date(epochMs + ms);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  const d = new Date(x as any);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function sha(obj: any) {
  return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}

function isHighRollerByName(name: string | null): boolean {
  if (!name) return false;
  return /\bhigh\s*roller\b/i.test(name);
}

async function bulkUpsert<T>(
  s: ReturnType<typeof supabaseAdmin>,
  table: string,
  rows: T[],
  onConflict?: string
) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await s
      .from(table)
      .upsert(chunk, { ignoreDuplicates: false, onConflict });
    if (error) throw error;
  }
}

async function bulkInsert<T>(
  s: ReturnType<typeof supabaseAdmin>,
  table: string,
  rows: T[]
) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await s.from(table).insert(chunk);
    if (error) throw error;
  }
}

async function bulkUpsertById<T extends { id: any }>(
  s: ReturnType<typeof supabaseAdmin>,
  table: string,
  rows: T[]
) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await s.from(table).upsert(chunk);
    if (error) throw error;
  }
}

// =======================
// Route
// =======================
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const note = normStr(form.get("note"));
    const softDeleteMissing = form.get("softDeleteMissing") === "1";
    if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

    // Read workbook
    const ab = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(ab), { type: "array" });

    const tpSheet = wb.Sheets["TotalPoints"];
    const evSheet = wb.Sheets["Events"];
    if (!tpSheet || !evSheet) {
      return NextResponse.json(
        { error: "Excel must contain sheets 'TotalPoints' and 'Events'" },
        { status: 400 }
      );
    }

    const tpRows: any[] = XLSX.utils.sheet_to_json(tpSheet, { defval: null });
    const evRows: any[] = XLSX.utils.sheet_to_json(evSheet, { defval: null });

    const s = supabaseAdmin();

    // Import batch
    const { data: batchRow, error: batchErr } = await s
      .from("admin_imports")
      .insert({ filename: file.name, note })
      .select("id")
      .single();
    if (batchErr) throw batchErr;
    const batchId: string = batchRow.id;

    // ===== 1) EVENTS (from Events sheet preferred)
    const evById = new Map<string, any>();
    const eventUpserts: any[] = [];
    const touchedEventIds = new Set<string>();

    for (const r of evRows) {
      const eventId =
        normStr(r["TournamentId"]) ||
        normStr(r["Tournament Id"]) ||
        normStr(r["TournamentID"]);
      if (!eventId) continue;

      const name = normStr(r["TournamentName"]) || normStr(r["Tournament Name"]);
      const site = normStr(r["SiteName"]) || normStr(r["Site"]);
      const startDate =
        toDateOnly(r["StartDateTime"]) ||
        toDateOnly(r["Start Date"]) ||
        toDateOnly(r["StartDate"]);
      const city = normStr(r["City"]);
      const isHR = isHighRollerByName(name || "");

      evById.set(eventId, r);
      eventUpserts.push({
        id: eventId,
        name: name || `Event ${eventId}`,
        start_date: startDate || "1970-01-01",
        site_name: site,
        city,
        is_high_roller: isHR,
      });
      touchedEventIds.add(eventId);
    }

    // ===== 2) PLAYERS + RESULTS (from TotalPoints)
    const playerUpserts: any[] = [];
    const resultPayloads: ResultPayload[] = [];
    const seenPlayersPerEvent = new Map<string, Set<string>>();

    for (const r of tpRows) {
      const playerId =
        normStr(r["Player Id"]) || normStr(r["PlayerId"]) || normStr(r["Id"]);
      const forename = normStr(r["Forename"]);
      const surname = normStr(r["Surname"]);
      const fullName =
        normStr(r["Full Name"]) || [forename, surname].filter(Boolean).join(" ");
      const gdpr = (r["GDPR"] ?? r["Gdpr"] ?? 0) ? true : false;

      const eventId =
        normStr(r["Tournament Id"]) || normStr(r["TournamentId"]);
      const casino = normStr(r["Casino"]);
      const tournamentName =
        normStr(r["Tournament Name"]) || normStr(r["TournamentName"]);
      const startDateTp = toDateOnly(r["Start Date"]);
      const buyInRaw = normStr(r["Buy In"]) || normStr(r["BuyIn"]);
      const points = Number(r["Points"] ?? 0);
      const position =
        r["Position Of Prize"] != null ? Number(r["Position Of Prize"]) : null;
      const prize =
        r["Prize Amount"] != null ? Number(r["Prize Amount"]) : null;
      const webSync =
        normStr(r["Web Sync Site Id"]) || normStr(r["WebSyncSiteId"]);

      if (!playerId || !eventId) continue;

      // queue player upsert
      playerUpserts.push({
        id: playerId,
        forename,
        surname,
        display_name: fullName || undefined,
      });

      // ensure event exists even if not in Events sheet
      if (!touchedEventIds.has(eventId)) {
        const evRow = evById.get(eventId) || {};
        const evName =
          normStr(evRow["TournamentName"]) ||
          tournamentName ||
          `Event ${eventId}`;
        const site = normStr(evRow["SiteName"]);
        const startDateEv = toDateOnly(evRow["StartDateTime"]);
        const city = normStr(evRow["City"]);
        const isHR = isHighRollerByName(evName || "");

        eventUpserts.push({
          id: eventId,
          name: evName,
          start_date: startDateEv || startDateTp || "1970-01-01",
          site_name: site,
          city,
          is_high_roller: isHR,
        });
        touchedEventIds.add(eventId);
      }

      // Decide result start_date (prefer Events sheet)
      const evMeta = evById.get(eventId) || {};
      const startDate =
        toDateOnly(evMeta["StartDateTime"]) ||
        toDateOnly(evMeta["Start Date"]) ||
        startDateTp ||
        "1970-01-01";

      const base: ResultBase = {
        player_id: playerId,
        event_id: eventId,
        start_date: startDate,
        points: Number.isFinite(points) ? Number(points.toFixed(2)) : 0,
        position_of_prize: position,
        prize_amount: prize,
        gdpr_flag: gdpr,
        tournament_name: (tournamentName || evMeta["TournamentName"] || null) as string | null,
        casino,
        buy_in_raw: buyInRaw,
        web_sync_site_id: webSync,
        is_deleted: false,
      };

      const payload: ResultPayload = {
        ...base,
        raw_hash: sha(base),
        import_batch_id: batchId,
      };

      resultPayloads.push(payload);

      if (!seenPlayersPerEvent.has(eventId)) seenPlayersPerEvent.set(eventId, new Set());
      seenPlayersPerEvent.get(eventId)!.add(playerId);
    }

    // ===== 3) BULK UPSERT players & events
    {
      const dedupPlayers = Array.from(new Map(playerUpserts.map(p => [p.id, p])).values());
      if (dedupPlayers.length) await bulkUpsert(s, "players", dedupPlayers);
    }
    {
      const dedupEvents = Array.from(new Map(eventUpserts.map(e => [e.id, e])).values());
      if (dedupEvents.length) await bulkUpsert(s, "events", dedupEvents);
    }

    // ===== 4) RESULTS — preload existing for touched events once
    const touchIds = Array.from(touchedEventIds);
    const existingMap = new Map<string, ExistingResult>();
    for (let i = 0; i < touchIds.length; i += CHUNK) {
      const chunk = touchIds.slice(i, i + CHUNK);
      const { data, error } = await s
        .from("results")
        .select("id, player_id, event_id, raw_hash, is_deleted")
        .in("event_id", chunk);
      if (error) throw error;
      for (const row of (data || []) as ExistingResult[]) {
        const key = `${row.player_id}|${row.event_id}`;
        existingMap.set(key, row);
      }
    }

    // Work out inserted/updated/unchanged
    const toInsert: ResultPayload[] = [];
    const toUpdateForLog: Array<{ id: string; before: any; after: ResultPayload }> = [];

    for (const r of resultPayloads) {
      const key = `${r.player_id}|${r.event_id}`;
      const ex = existingMap.get(key);
      if (!ex) {
        toInsert.push(r);
      } else {
        if (ex.raw_hash !== r.raw_hash || ex.is_deleted) {
          toUpdateForLog.push({
            id: ex.id,
            before: { raw_hash: ex.raw_hash, is_deleted: ex.is_deleted },
            after: r,
          });
        }
      }
    }

    // One big upsert on (player_id,event_id)
    if (resultPayloads.length) {
      await bulkUpsert(s, "results", resultPayloads, "player_id,event_id");
    }

    // ===== 5) Change log (bulk insert)
    const changeRows: any[] = [];
    for (const r of toInsert) {
      changeRows.push({
        result_id: null, // optional, we skip fetching UUID to keep this fast
        change_type: "insert",
        before_json: null,
        after_json: r,
        import_batch_id: batchId,
      });
    }
    for (const u of toUpdateForLog) {
      changeRows.push({
        result_id: u.id,
        change_type: "update",
        before_json: u.before,
        after_json: u.after,
        import_batch_id: batchId,
      });
    }
    if (changeRows.length) {
      await bulkInsert(s, "result_changes", changeRows);
    }

    // ===== 6) Optional soft-delete entries missing in this import
    let softDeleted = 0;
    if (softDeleteMissing && touchIds.length > 0) {
      for (let i = 0; i < touchIds.length; i += CHUNK) {
        const chunk = touchIds.slice(i, i + CHUNK);
        const { data: rows, error } = await s
          .from("results")
          .select("id, player_id, event_id, is_deleted")
          .in("event_id", chunk);
        if (error) throw error;

        const toSoft: { id: string; is_deleted: boolean; updated_at: string; import_batch_id: string }[] = [];
        for (const row of (rows || []) as { id: string; player_id: string; event_id: string; is_deleted: boolean }[]) {
          const set = seenPlayersPerEvent.get(row.event_id) || new Set<string>();
          if (!set.has(row.player_id) && !row.is_deleted) {
            toSoft.push({
              id: row.id,
              is_deleted: true,
              updated_at: new Date().toISOString(),
              import_batch_id: batchId,
            });
          }
        }

        if (toSoft.length) {
          await bulkUpsertById(s, "results", toSoft);
          softDeleted += toSoft.length;

          const logRows = toSoft.map((r) => ({
            result_id: r.id,
            change_type: "soft_delete",
            before_json: { is_deleted: false },
            after_json: { is_deleted: true },
            import_batch_id: batchId,
          }));
          await bulkInsert(s, "result_changes", logRows);
        }
      }
    }

    const inserted = toInsert.length;
    const updated = toUpdateForLog.length;
    const unchanged = resultPayloads.length - inserted - updated;

    return NextResponse.json({
      ok: true,
      batchId,
      stats: { inserted, updated, unchanged, softDeleted },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
