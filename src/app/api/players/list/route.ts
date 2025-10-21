// src/app/api/players/list/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const revalidate = 0;

type PlayerRow = {
  id: string;
  forename: string | null;
  surname: string | null;
  avatar_url: string | null;
  created_at: string;
};

function displayName(p: PlayerRow) {
  const f = (p.forename || "").trim();
  const s = (p.surname || "").trim();
  return [f, s].filter(Boolean).join(" ").trim() || "Unknown";
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") || "25")));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const s = supabaseAdmin();

    // Base players query (no imaginary "name" column)
    let base = s
      .from("players")
      .select("id,forename,surname,avatar_url,created_at")
      .order("created_at", { ascending: false })
      .range(from, to);

    // If q provided, search forename/surname (we’ll also include aliases via a second query)
    if (q) {
      // Use OR over real columns
      base = base.or(
        `forename.ilike.%${q}%,surname.ilike.%${q}%`
      );
    }

    const { data: players, error } = await base;
    if (error) throw error;

    // If q is present, include alias matches too
    let rows: PlayerRow[] = (players || []) as any;

    if (q) {
      // Find alias matches (player_aliases.alias ilike %q%)
      const { data: aliasMatches, error: aErr } = await s
        .from("player_aliases")
        .select("player_id,alias")
        .ilike("alias", `%${q}%`);
      if (aErr) throw aErr;

      const aliasSet = new Set((aliasMatches || []).map((a) => String(a.player_id)));
      // Fetch any players referenced by alias that aren’t already in rows
      const missingIds = Array.from(aliasSet).filter(
        (pid) => !rows.some((r) => String(r.id) === pid)
      );
      if (missingIds.length) {
        const { data: aliasPlayers, error: pErr } = await s
          .from("players")
          .select("id,forename,surname,avatar_url,created_at")
          .in("id", missingIds);
        if (pErr) throw pErr;
        rows = rows.concat((aliasPlayers || []) as any);
      }
    }

    // Map to response shape
    const out = rows.map((p) => ({
      id: String(p.id),
      name: displayName(p),
      avatar_url: p.avatar_url || null,
      created_at: p.created_at,
    }));

    return NextResponse.json({ page, pageSize, rows: out });
  } catch (e: any) {
    return NextResponse.json({ _error: String(e?.message || e) }, { status: 500 });
  }
}
