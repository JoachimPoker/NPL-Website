import { headers } from "next/headers";
import Link from "next/link";

export const runtime = "nodejs";
export const revalidate = 60;

type Series = {
  id: string;
  label: string;
  is_active: boolean;
  description?: string | null;
};

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

/** Try multiple endpoints until one returns a list. */
async function loadSeries(): Promise<Series[]> {
  const candidates = [
    "/api/series/list",
    "/api/series",
    "/api/admin/series/list",
    "/api/admin/series",
  ];

  for (const path of candidates) {
    const resp = await fetchJSON<any>(path);
    if (!resp) continue;

    const raw: any[] =
      (Array.isArray(resp) ? resp : undefined) ??
      resp?.series ??
      resp?.items ??
      resp?.data ??
      resp?.rows ??
      [];

    if (Array.isArray(raw) && raw.length >= 0) {
      return raw.map((s: any) => {
        const id = String(s.id ?? s.series_id ?? s.slug ?? s.key ?? "");
        const label = String(s.label ?? s.name ?? s.title ?? "Series");
        const is_active = Boolean(s.is_active ?? s.active ?? s.enabled ?? true);
        const description = typeof s.description === "string" ? s.description : null;
        return { id, label, is_active, description };
      });
    }
  }
  return [];
}

export default async function EventsOverviewPage() {
  const items = await loadSeries();

  return (
    <div className="container mx-auto max-w-7xl space-y-8 py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-6">
        <div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">
            Tournaments
          </h1>
          <p className="text-base-content/60 mt-1 font-medium">
            Browse events by Series
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {!items.length ? (
          <div className="col-span-full p-12 text-center card bg-base-100 border border-white/5">
            <p className="text-base-content/50 italic">No tournament series found.</p>
          </div>
        ) : (
          items.map((s) => (
            <Link 
              key={s.id} 
              href={`/events/${encodeURIComponent(s.id)}`}
              className="card bg-base-100 shadow-xl border border-white/5 hover:border-primary/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="card-body">
                <div className="flex items-start justify-between">
                  <h3 className="card-title text-xl font-bold group-hover:text-primary transition-colors">
                    {s.label}
                  </h3>
                  {s.is_active && (
                    <div className="badge badge-success badge-sm font-bold uppercase text-xs">Active</div>
                  )}
                </div>
                
                {s.description && (
                  <p className="text-sm text-base-content/60 line-clamp-2 mt-2">
                    {s.description}
                  </p>
                )}
                
                <div className="card-actions justify-end mt-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-base-content/40 group-hover:text-primary transition-colors">
                    View Series →
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}