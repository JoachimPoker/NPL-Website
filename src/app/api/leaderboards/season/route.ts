import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
// ⚠️ FIX: Explicitly force dynamic rendering to allow cookies()
export const dynamic = "force-dynamic"; 

type SeasonRow = {
  id: number;
  label: string;
  start_date: string; // ISO date
  end_date: string;   // ISO date
  method?: "ALL" | "BEST_X" | null;
  cap_x?: number | null;
  is_active?: boolean | null;
};

function bad(code: number, msg: string, extra?: any) {
  return NextResponse.json({ ok: false, error: msg, extra }, { status: code });
}

function parseLeague(v: string | null): "npl" | "hrl" {
  const s = (v || "").toLowerCase();
  return s === "hrl" ? "hrl" : "npl";
}

function isISODate(s: string | null | undefined) {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseRouteClient();
    const url = new URL(req.url);

    const seasonIdParam = (url.searchParams.get("seasonId") || "current").trim();
    const league = parseLeague(url.searchParams.get("league") || url.searchParams.get("type"));
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 100)));
    const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
    const search = (url.searchParams.get("search") || url.searchParams.get("q") || "").trim() || null;

    const methodOverride = (url.searchParams.get("method") || "").toUpperCase() as "" | "ALL" | "BEST_X";
    const capOverride = url.searchParams.has("cap")
      ? Number(url.searchParams.get("cap"))
      : null;

    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    let season: SeasonRow | null = null;
    let p_from: string;
    let p_to: string;
    let baseMethod: "ALL" | "BEST_X" = "ALL";
    let baseCap = 0;

    const trySeasonLookup = async () => {
      if (seasonIdParam === "current") {
        const { data, error } = await supabase
          .from("seasons")
          .select("id,label,start_date,end_date,is_active") // removed method/cap_x if missing in DB
          .eq("is_active", true)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Active season not found");
        return data as unknown as SeasonRow;
      } else {
        const sid = Number(seasonIdParam);
        if (!Number.isFinite(sid)) throw new Error("Invalid seasonId");
        const { data, error } = await supabase
          .from("seasons")
          .select("id,label,start_date,end_date,is_active") // removed method/cap_x if missing in DB
          .eq("id", sid)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Season not found");
        return data as unknown as SeasonRow;
      }
    };

    try {
      season = await trySeasonLookup();
      p_from = season.start_date.slice(0, 10);
      p_to = season.end_date.slice(0, 10);
      // Fallback defaults since cols are missing in DB
      baseMethod = "ALL"; 
      baseCap = 0;
    } catch (seasonErr: any) {
      if (isISODate(fromParam) && isISODate(toParam)) {
        season = {
          id: 0,
          label: `Custom ${fromParam} → ${toParam}`,
          start_date: fromParam!,
          end_date: toParam!,
          method: "ALL",
          cap_x: 0,
          is_active: false,
        };
        p_from = fromParam!;
        p_to = toParam!;
      } else {
        return bad(500, "Season lookup failed and no ?from=YYYY-MM-DD&to=YYYY-MM-DD provided.", {
          reason: seasonErr?.message || String(seasonErr),
          hint: "Either fix seasons table/RLS or call with explicit ?from & ?to.",
        });
      }
    }

    const method = (methodOverride || baseMethod) as "ALL" | "BEST_X";
    const cap = method === "BEST_X" ? (capOverride ?? baseCap ?? 0) : 0;

    if (new Date(p_from) > new Date(p_to)) {
      return bad(400, "from cannot be after to");
    }

    const { data: rows, error: rpcErr } = await supabase.rpc("leaderboard_season", {
      p_from,
      p_to,
      p_league: league,
      p_method: method,
      p_cap: cap,
      p_search: search || undefined, // undefined instead of null for RPC
      p_limit: limit,
      p_offset: offset,
    });

    if (rpcErr) {
      return bad(500, "leaderboard_season RPC failed", { rpc: rpcErr.message });
    }

    return NextResponse.json({
      ok: true,
      meta: {
        league,
        season: {
          id: season.id,
          label: season.label,
          start_date: p_from,
          end_date: p_to,
          method,
          cap_x: cap,
          is_active: !!season.is_active,
        },
        limit,
        offset,
        total_hint: offset + (rows?.length || 0),
      },
      rows: rows ?? [],
    });
  } catch (e: any) {
    return bad(500, e?.message || "Unexpected error");
  }
}