import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function bad(status: number, msg: string, extra?: any) {
  return NextResponse.json({ ok: false, error: msg, extra }, { status });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseRouteClient();
  const eventId = params.id;

  // Event
  const { data: ev, error: evErr } = await supabase
    .from("events")
    .select("id, name, start_date, site_name, buy_in_raw")
    .eq("id", eventId)
    .maybeSingle();
  if (evErr) return bad(500, evErr.message);
  if (!ev) return bad(404, "Event not found");

  // Results (join for player names, GDPR handled in API)
  const { data: resRows, error: rErr } = await supabase
    .from("results")
    .select("id, player_id, points, prize_amount, position_of_prize, gdpr_flag, created_at, players:player_id (forename, surname, display_name)")
    .eq("event_id", eventId)
    .order("points", { ascending: false });
  if (rErr) return bad(500, rErr.message);

  const rows = (resRows || []).map((r: any) => {
    const consent = !!r.gdpr_flag;
    const forename = r.players?.forename ?? null;
    const surname = r.players?.surname ?? null;
    const display_name_raw = r.players?.display_name ?? null;

    let name: string;
    if (consent) {
      name = (display_name_raw && display_name_raw.trim())
        || [forename, surname].filter(Boolean).join(" ").trim()
        || "Anonymous";
    } else {
      const fi = (forename || "").trim().slice(0,1).toUpperCase();
      const si = (surname || "").trim().slice(0,1).toUpperCase();
      name = (fi || si) ? `${fi ? fi + "." : ""}${fi && si ? " " : ""}${si ? si + "." : ""}` : "Anonymous";
    }

    return {
      id: r.id,
      player_id: r.player_id,
      name,
      points: r.points,
      prize_amount: r.prize_amount,
      position_of_prize: r.position_of_prize,
      created_at: r.created_at,
    };
  });

  return NextResponse.json({
    ok: true,
    event: ev,
    results: rows,
  });
}
