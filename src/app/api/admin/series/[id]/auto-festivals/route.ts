// src/app/api/admin/series/[id]/auto-festivals/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const revalidate = 0;

type Ev = { id: string; name: string | null; start_date: string };

const MAX_GAP_DAYS = 5; // break cluster if gap > 5 days

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}
function parseYMD(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function daysBetween(a: string, b: string) {
  const ms = parseYMD(b).getTime() - parseYMD(a).getTime();
  return Math.round(ms / 86400000);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const s = supabaseAdmin();

  try {
    const { id } = await ctx.params;
    const seriesId = Number(String(id || "").trim());
    const url = new URL(req.url);
    const dry = url.searchParams.get("dry") === "1";

    if (!Number.isFinite(seriesId)) {
      return NextResponse.json({ _error: "Bad series id" }, { status: 400 });
    }

    // Get the series (name/slug helpful for labels)
    const { data: series, error: sErr } = await s
      .from("series")
      .select("id,name,slug")
      .eq("id", seriesId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!series) return NextResponse.json({ _error: "Series not found" }, { status: 404 });

    // Fetch events for that series
    const { data: evs, error: eErr } = await s
      .from("events")
      .select("id,name,start_date,series_id,festival_id,is_deleted")
      .eq("series_id", seriesId)
      .is("is_deleted", false)
      .order("start_date", { ascending: true });
    if (eErr) throw eErr;

    const events: Ev[] = (evs ?? [])
      .filter((e: any) => !!e.start_date)
      .map((e: any) => ({
        id: String(e.id),
        name: e.name ?? null,
        start_date: String(e.start_date),
      }));

    // Build clusters (contiguous groups with <= MAX_GAP_DAYS gap)
    const clusters: {
      start_date: string;
      end_date: string;
      label: string;
      event_ids: string[];
      sample_events: string[]; // up to 3 names for preview
    }[] = [];

    let cur: Ev[] = [];
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (!cur.length) {
        cur.push(ev);
        continue;
      }
      const last = cur[cur.length - 1];
      const gap = daysBetween(last.start_date, ev.start_date);
      if (gap > MAX_GAP_DAYS) {
        const start = cur[0].start_date;
        const end = cur[cur.length - 1].start_date;
        clusters.push({
          start_date: start,
          end_date: end,
          label: `${series.name} (${start} → ${end})`,
          event_ids: cur.map((x) => x.id),
          sample_events: cur.slice(0, 3).map((x) => x.name || x.id),
        });
        cur = [ev];
      } else {
        cur.push(ev);
      }
    }
    if (cur.length) {
      const start = cur[0].start_date;
      const end = cur[cur.length - 1].start_date;
      clusters.push({
        start_date: start,
        end_date: end,
        label: `${series.name} (${start} → ${end})`,
        event_ids: cur.map((x) => x.id),
        sample_events: cur.slice(0, 3).map((x) => x.name || x.id),
      });
    }

    if (dry) {
      // Rich preview
      return NextResponse.json({
        dry: true,
        series: { id: series.id, name: series.name, slug: series.slug },
        clusters: clusters.map((c) => ({
          label: c.label,
          start_date: c.start_date,
          end_date: c.end_date,
          events_count: c.event_ids.length,
          sample_events: c.sample_events,
        })),
      });
    }

    // Mutating mode: upsert festivals and assign events.
    let created = 0;
    let reused = 0;
    let assigned = 0;

    for (const c of clusters) {
      // Reuse if a festival already exists with the same date window
      const { data: exists, error: fErr } = await s
        .from("festivals")
        .select("id")
        .eq("series_id", seriesId)
        .eq("start_date", c.start_date)
        .eq("end_date", c.end_date)
        .maybeSingle();
      if (fErr) throw fErr;

      let festivalId: string;
      if (exists?.id) {
        reused++;
        festivalId = String(exists.id);
      } else {
        const { data: inserted, error: iErr } = await s
          .from("festivals")
          .insert({
            series_id: seriesId,
            label: c.label,
            start_date: c.start_date,
            end_date: c.end_date,
            city: null,
          })
          .select("id")
          .single();
        if (iErr) throw iErr;
        festivalId = String(inserted.id);
        created++;
      }

      // Assign events to this festival
      const { error: uErr } = await s
        .from("events")
        .update({ festival_id: festivalId })
        .in("id", c.event_ids);
      if (uErr) throw uErr;
      assigned += c.event_ids.length;
    }

    return NextResponse.json({
      dry: false,
      clusters: clusters.length,
      created_festivals: created,
      reused_festivals: reused,
      events_assigned: assigned,
    });
  } catch (e: any) {
    return NextResponse.json({ _error: String(e?.message || e) }, { status: 500 });
  }
}
