// Lists events that belong to a given series (by numeric id).
// Used by /admin/series/[id] page to show assigned vs unassigned-to-festival.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type EventRow = {
  id: string;
  tournament_name?: string | null;
  event_name?: string | null;
  name?: string | null;
  title?: string | null;
  casino?: string | null;
  venue?: string | null;
  location?: string | null;
  start_date?: string | null;
  date?: string | null;
  event_date?: string | null;
  series_id: number | null;
  festival_id: number | null;
  is_deleted?: boolean | null;
};

export async function GET(
  _req: Request,
  ctx: { params: { id: string } }
) {
  try {
    const raw = String(ctx.params?.id ?? "").trim();
    const seriesId = Number(raw);
    if (!Number.isFinite(seriesId)) {
      return NextResponse.json(
        { _error: "Series id must be a number." },
        { status: 400 }
      );
    }

    const s = supabaseAdmin();

    // Fetch all events that are assigned to this series
    const { data, error } = await s
      .from("events")
      .select("*")
      .eq("series_id", seriesId)
      .eq("is_deleted", false)
      .order("start_date", { ascending: true });

    if (error) throw error;

    const events: EventRow[] = (data || []).map((e: any) => ({
      id: String(e.id),
      tournament_name: e.tournament_name ?? null,
      event_name: e.event_name ?? null,
      name: e.name ?? null,
      title: e.title ?? null,
      casino: e.casino ?? null,
      venue: e.venue ?? null,
      location: e.location ?? null,
      start_date: e.start_date ? String(e.start_date) : null,
      date: e.date ? String(e.date) : null,
      event_date: e.event_date ? String(e.event_date) : null,
      series_id: typeof e.series_id === "number" ? e.series_id : (e.series_id ?? null),
      festival_id: e.festival_id ?? null,
      is_deleted: !!e.is_deleted,
    }));

    return NextResponse.json({ events });
  } catch (e: any) {
    return NextResponse.json(
      { _error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
