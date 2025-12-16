import { headers } from "next/headers";
import Link from "next/link";

export const runtime = "nodejs";
export const revalidate = 60;

/* ---------- Types ---------- */
type FestivalMeta = {
  id: string;
  label: string;
  start_date?: string | null;
  end_date?: string | null;
};
type EventRow = {
  id: string;
  name: string;
  date?: string | null;
  venue?: string | null;
  is_high_roller?: boolean;
};

/* ---------- Helpers ---------- */
async function baseUrl() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host")) ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
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
    start_date: typeof f.start_date === "string" ? f.start_date : typeof f.date_from === "string" ? f.date_from : null,
    end_date: typeof f.end_date === "string" ? f.end_date : typeof f.date_to === "string" ? f.date_to : null,
  };
}

function normalizeEvents(resp: any): EventRow[] {
  const arr: any[] = (Array.isArray(resp?.events) ? resp.events : undefined) ?? (Array.isArray(resp) ? resp : []) ?? [];
  return arr.map((e) => ({
    id: String(e.id ?? e.event_id ?? ""),
    name: String(e.name ?? e.event_name ?? "Event"),
    date: typeof e.date === "string" ? e.date : typeof e.event_date === "string" ? e.event_date : null,
    venue: typeof e.venue === "string" ? e.venue : typeof e.location === "string" ? e.location : null,
    is_high_roller: Boolean(e.is_high_roller ?? e.is_hrl ?? e.hrl ?? false),
  }));
}

/* ---------- Page ---------- */
export default async function FestivalPage(props: {
  params: Promise<{ seriesId: string; festivalId: string }>;
}) {
  const params = await props.params;
  const { seriesId, festivalId } = params;

  const metaResp = await fetchJSON<any>(`/api/festivals/${encodeURIComponent(festivalId)}`);
  const eventsResp = await fetchJSON<any>(`/api/events/list?festivalId=${encodeURIComponent(festivalId)}`);

  const meta = metaResp ? normalizeFestival(metaResp) : { id: festivalId, label: `Festival ${festivalId}` };
  const events = normalizeEvents(eventsResp);

  return (
    <div className="container mx-auto max-w-7xl space-y-8 py-8 px-4">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-white/5 pb-6">
        <nav className="text-xs font-bold uppercase tracking-widest text-base-content/40 flex gap-2 mb-2">
          <Link href="/events" className="hover:text-primary transition-colors">Events</Link> 
          <span>/</span> 
          <Link href={`/events/${seriesId}`} className="hover:text-primary transition-colors">Series</Link>
        </nav>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">
              {meta.label}
            </h1>
            <p className="text-base-content/60 font-medium mt-1">
              {meta.start_date || "TBA"} <span className="mx-2 text-primary">•</span> {meta.end_date || "TBA"}
            </p>
          </div>
        </div>
      </div>

      {/* Events Table Card */}
      <div className="card bg-base-100 shadow-xl border border-white/5 overflow-hidden">
        <div className="card-header p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-xl font-bold uppercase tracking-wide">Schedule</h3>
          <span className="badge badge-outline text-xs font-bold uppercase">{events.length} Events</span>
        </div>
        
        <div className="p-0 overflow-x-auto">
          {!events.length ? (
            <div className="p-12 text-center text-base-content/50 italic">No events found.</div>
          ) : (
            <table className="table table-lg w-full">
              <thead>
                <tr className="bg-base-200/50 text-xs uppercase text-base-content/60 border-b border-white/5">
                  <th className="w-32">Date</th>
                  <th>Event</th>
                  <th>Venue</th>
                  <th className="text-center">Type</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-base-200/30 transition-colors border-b border-base-200/50 last:border-0">
                    <td className="font-mono text-sm opacity-70">{e.date ?? "TBA"}</td>
                    <td className="font-bold text-white text-lg">
                      {e.name}
                    </td>
                    <td className="text-sm opacity-60">{e.venue ?? "—"}</td>
                    <td className="text-center">
                      <span className={`badge badge-sm font-bold uppercase tracking-wide ${e.is_high_roller ? "badge-secondary text-secondary-content" : "badge-ghost opacity-50"}`}>
                        {e.is_high_roller ? "High Roller" : "NPL"}
                      </span>
                    </td>
                    <td className="text-right">
                      <button className="btn btn-xs btn-outline uppercase font-bold disabled:opacity-50" disabled>
                        View Results
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}