// src/app/events/[seriesId]/[festivalId]/page.tsx
import { headers } from "next/headers";

export const runtime = "nodejs";
export const revalidate = 0;

type FestivalMeta = { id: string; label: string; start_date?: string | null; end_date?: string | null };
type EventRow = { id: string; name: string; date?: string | null; venue?: string | null; is_high_roller?: boolean };

async function baseUrl() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host")) ?? "localhost:3000";
  const proto = (h.get("x-forwarded-proto") ?? "http");
  return `${proto}://${host}`;
}
async function fetchJSON<T>(path: string): Promise<T | null> {
  const res = await fetch(`${await baseUrl()}${path}`, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function normalizeFestival(resp: any): FestivalMeta {
  const f = resp?.festival ?? resp ?? {};
  return {
    id: String(f.id ?? f.festival_id ?? ""),
    label: String(f.label ?? f.name ?? f.title ?? "Festival"),
    start_date: typeof f.start_date === "string" ? f.start_date : (typeof f.date_from === "string" ? f.date_from : null),
    end_date: typeof f.end_date === "string" ? f.end_date : (typeof f.date_to === "string" ? f.date_to : null),
  };
}
function normalizeEvents(resp: any): EventRow[] {
  const arr: any[] =
    (Array.isArray(resp?.events) ? resp.events : undefined) ??
    (Array.isArray(resp) ? resp : []) ?? [];
  return arr.map((e) => ({
    id: String(e.id ?? e.event_id ?? ""),
    name: String(e.name ?? e.event_name ?? "Event"),
    date:
      typeof e.date === "string"
        ? e.date
        : typeof e.event_date === "string"
        ? e.event_date
        : null,
    venue: typeof e.venue === "string" ? e.venue : (typeof e.location === "string" ? e.location : null),
    is_high_roller: Boolean(e.is_high_roller ?? e.is_hrl ?? e.hrl ?? false),
  }));
}

export default async function FestivalPage({
  params,
}: {
  params: { seriesId: string; festivalId: string };
}) {
  const { seriesId, festivalId } = params;

  const metaResp = await fetchJSON<any>(`/api/festivals/${encodeURIComponent(festivalId)}`);
  const eventsResp = await fetchJSON<any>(`/api/events/list?festivalId=${encodeURIComponent(festivalId)}`);

  const meta = metaResp ? normalizeFestival(metaResp) : { id: festivalId, label: `Festival ${festivalId}` };
  const events = normalizeEvents(eventsResp);

  return (
    <div className="space-y-6">
      <section className="card p-4">
        <nav className="text-sm mb-1">
          <a className="underline" href="/events">Events</a>
          <span className="mx-1">/</span>
          <a className="underline" href={`/events/${encodeURIComponent(seriesId)}`}>Series</a>
        </nav>

        <h1 className="text-2xl font-semibold">{meta.label}</h1>
        <div className="text-sm text-neutral-600 mt-1">
          {meta.start_date ? meta.start_date : ""}{meta.end_date ? ` → ${meta.end_date}` : ""}
        </div>
      </section>

      <section className="card overflow-x-auto">
        <div className="card-header">Events</div>
        {!events.length ? (
          <div className="card-body text-sm text-neutral-600">No events in this festival yet.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th className="text-left">Date</th>
                <th className="text-left">Event</th>
                <th className="text-left">Venue</th>
                <th className="text-left">League</th>
                <th className="text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{e.date ?? "—"}</td>
                  <td>{e.name}</td>
                  <td>{e.venue ?? ""}</td>
                  <td>
                    <span className={`badge ${e.is_high_roller ? "badge-hrl" : "badge-npl"}`}>
                      {e.is_high_roller ? "HRL" : "NPL"}
                    </span>
                  </td>
                  <td>
                    <a className="underline" href={`/events/${encodeURIComponent(e.id)}`}>View results →</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="text-sm">
        <a className="underline" href={`/events/${encodeURIComponent(seriesId)}`}>← Back to series</a>
      </div>
    </div>
  );
}
