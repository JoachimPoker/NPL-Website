import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer"; // ⬅️ route client
import { displayName } from "@/lib/nameMask";

export const dynamic = "force-dynamic";

type PlayerRow = {
  id: string;
  forename: string | null;
  surname: string | null;
  display_name: string | null;
  avatar_url: string | null;
};
type ConsentRow = { player_id: string; gdpr_flag: boolean | null };

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient(); // ⬅️
  const { searchParams } = new URL(req.url);

  const q = (searchParams.get("q") || "").trim();
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(5, Number(searchParams.get("pageSize") || 20)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("players")
    .select("id, forename, surname, display_name, avatar_url", { count: "exact" })
    .order("surname", { ascending: true })
    .range(from, to);

  if (q) {
    query = query.or(`display_name.ilike.%${q}%,forename.ilike.%${q}%,surname.ilike.%${q}%`);
  }

  const { data: players, error, count } = await query as {
    data: PlayerRow[] | null; error: any; count: number | null;
  };

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (players || []).map((p) => p.id);
  const consentByPlayer = new Map<string, boolean>();

  if (ids.length) {
    const { data: consents, error: cErr } = await supabase
      .from("results")
      .select("player_id, gdpr_flag")
      .in("player_id", ids) as { data: ConsentRow[] | null; error: any };
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
    for (const row of consents || []) {
      if (row.gdpr_flag) consentByPlayer.set(row.player_id, true);
      else if (!consentByPlayer.has(row.player_id)) consentByPlayer.set(row.player_id, false);
    }
  }

  const rows = (players || []).map((p) => {
    const consent = consentByPlayer.get(p.id) ?? false;
    return {
      id: p.id,
      name: displayName(p.forename, p.surname, consent, p.display_name),
      avatar_url: p.avatar_url,
      consent,
    };
  });

  return NextResponse.json({
    meta: { page, pageSize, total: count ?? 0, query: q },
    rows,
  });
}
