// Parses the weekly "RawPlayerData" league report (sheet "TotalPoints") into rows
// for the import_season_report() database function. Pure and dependency-free so it
// can be tested directly against real report files.

export type ReportRow = {
  player_id: number;
  forename: string | null;
  surname: string | null;
  full_name: string | null;
  date_of_birth: string | null; // YYYY-MM-DD
  card_number: number | null;
  membership_number: number | null;
  gdpr: boolean;
  tournament_id: number;
  casino: string | null;
  tournament_name: string | null;
  start_date: string | null; // local wall-clock time, "YYYY-MM-DDTHH:mm:ss"
  buy_in: number | null;
  points: number;
  finish_position: number | null;
  prize_position: number | null;
  prize_amount: number | null;
  web_sync_site_id: number | null;
  penalty_points: number; // extra negative-points rows for the same player and tournament (penalties)
  occ: number; // always 0 once duplicates are merged; part of the row key
};

export type ParseResult = {
  rows: ReportRow[];
  warnings: string[];
  stats: { rows: number; players: number; tournaments: number; firstDate: string | null; lastDate: string | null };
};

export const REPORT_SHEET = "TotalPoints";

const REQUIRED = ["Player Id", "Tournament Id", "Points"] as const;

// Excel stores dates as serial day numbers from 1899-12-30. The reader returns cells
// formatted as dates as JS Dates in UTC holding the sheet's wall-clock time.
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s.toUpperCase() === "NULL" ? null : s;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  // A numeric cell accidentally formatted as a date in Excel: recover the number.
  if (v instanceof Date) return Math.round((v.getTime() - EXCEL_EPOCH) / 86_400_000);
  const s = String(v).replace(/[£$,\s]/g, "");
  if (s === "" || s.toUpperCase() === "NULL") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Identifiers such as card numbers: digits only, otherwise treated as missing.
function digits(v: unknown): number | null {
  const s = str(v);
  if (!s || !/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

function localDateTime(v: unknown): string | null {
  if (!(v instanceof Date) || Number.isNaN(v.getTime())) return null;
  return v.toISOString().slice(0, 19);
}

function dateOnly(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = str(v);
  const m = s?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // dd/mm/yyyy
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

export function parseReport(sheetRows: unknown[][]): ParseResult {
  if (!sheetRows.length) throw new Error(`Sheet "${REPORT_SHEET}" is empty.`);

  const header = sheetRows[0].map((h) => String(h ?? "").trim());
  const missing = REQUIRED.filter((h) => !header.includes(h));
  if (missing.length) throw new Error(`Missing column(s): ${missing.join(", ")}. Is this a RawPlayerData report?`);
  const col = (name: string) => header.indexOf(name);
  const idx = {
    position: col("Position"), playerId: col("Player Id"), forename: col("Forename"), surname: col("Surname"),
    fullName: col("Full Name"), dob: col("Date Of Birth"), card: col("Card Number"), membership: col("Membership Number"),
    gdpr: col("GDPR"), tournamentId: col("Tournament Id"), casino: col("Casino"), tournamentName: col("Tournament Name"),
    startDate: col("Start Date"), buyIn: col("Buy In"), points: col("Points"), prizePosition: col("Position Of Prize"),
    prizeAmount: col("Prize Amount"), webSync: col("Web Sync Site Id"),
  };
  const at = (r: unknown[], i: number) => (i >= 0 ? r[i] : null);

  const warnings: string[] = [];
  const rows: ReportRow[] = [];
  const eventInfo = new Map<number, { buy_in: number | null; start_date: string | null }>();

  sheetRows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const player_id = digits(at(r, idx.playerId));
    const tournament_id = digits(at(r, idx.tournamentId));
    if (player_id === null || tournament_id === null) {
      if (r.some((c) => c !== null && c !== "")) warnings.push(`Row ${line}: missing Player Id or Tournament Id, skipped.`);
      return;
    }
    const points = num(at(r, idx.points));
    if (points === null) {
      warnings.push(`Row ${line}: no points value, skipped.`);
      return;
    }

    const row: ReportRow = {
      player_id,
      forename: str(at(r, idx.forename)),
      surname: str(at(r, idx.surname)),
      full_name: str(at(r, idx.fullName)),
      date_of_birth: dateOnly(at(r, idx.dob)),
      card_number: digits(at(r, idx.card)),
      membership_number: digits(at(r, idx.membership)),
      gdpr: num(at(r, idx.gdpr)) === 1,
      tournament_id,
      casino: str(at(r, idx.casino)),
      tournament_name: str(at(r, idx.tournamentName)),
      start_date: localDateTime(at(r, idx.startDate)),
      buy_in: num(at(r, idx.buyIn)),
      points,
      finish_position: num(at(r, idx.position)),
      prize_position: num(at(r, idx.prizePosition)),
      prize_amount: num(at(r, idx.prizeAmount)),
      web_sync_site_id: num(at(r, idx.webSync)),
      penalty_points: 0,
      occ: 0,
    };
    rows.push(row);

    const seen = eventInfo.get(tournament_id);
    if (!seen) eventInfo.set(tournament_id, { buy_in: row.buy_in, start_date: row.start_date });
    else if (seen.buy_in !== row.buy_in && row.buy_in !== null && seen.buy_in !== null) {
      warnings.push(`Tournament ${tournament_id}: rows disagree on buy-in (${seen.buy_in} vs ${row.buy_in}).`);
    }
  });

  // One result per player per tournament. Extra rows for the same player are penalties
  // (negative points): fold them into the main row's penalty_points.
  const byKey = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const k = `${row.tournament_id}:${row.player_id}`;
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(row);
  }
  const merged: ReportRow[] = [];
  for (const [k, list] of byKey) {
    if (list.length === 1) {
      merged.push(list[0]);
      continue;
    }
    list.sort((a, b) => b.points - a.points);
    const [main, ...extra] = list;
    const penalties = extra.filter((x) => x.points < 0);
    main.penalty_points = penalties.reduce((sum, x) => sum + x.points, 0);
    merged.push(main);
    const [tid, pid] = k.split(":");
    warnings.push(
      penalties.length === extra.length
        ? `Player ${pid}, tournament ${tid}: penalty of ${main.penalty_points} pts applied to their result (${main.points} pts).`
        : `Player ${pid} appears ${list.length}× in tournament ${tid} (points: ${list.map((x) => x.points).join(", ")}); kept the best result${penalties.length ? " and applied the penalty" : ""}.`
    );
  }
  rows.length = 0;
  rows.push(...merged);

  if (!rows.length) throw new Error("No result rows found in the report.");
  const dates = rows.map((r) => r.start_date).filter((d): d is string => !!d).sort();
  return {
    rows,
    warnings,
    stats: {
      rows: rows.length,
      players: new Set(rows.map((r) => r.player_id)).size,
      tournaments: eventInfo.size,
      firstDate: dates[0]?.slice(0, 10) ?? null,
      lastDate: dates[dates.length - 1]?.slice(0, 10) ?? null,
    },
  };
}

// "RawPlayerData2026Week37.xlsx" -> 2026
export function yearFromFilename(name: string): number | null {
  const m = name.match(/(20\d{2})/);
  return m ? Number(m[1]) : null;
}
