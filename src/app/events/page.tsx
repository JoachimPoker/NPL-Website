// src/app/events/page.tsx
import { headers } from "next/headers";

export const runtime = "nodejs";
export const revalidate = 0;

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
    "/api/series",              // sometimes list endpoints are plural base
    "/api/admin/series/list",   // admin variants
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
        const description =
          typeof s.description === "string" ? s.description : null;
        return { id, label, is_active, description };
      });
    }
  }
  return [];
}

export default async function EventsOverviewPage() {
  const items = await loadSeries();

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <div>Events — Series Overview</div>
          <div className="text-sm">
            <a className="underline" href="/admin/series">Manage series →</a>
          </div>
        </div>
        <div className="card-body">
          {!items.length ? (
            <div className="text-sm text-neutral-600">
              No series found. (If you see them in Admin, this page was hitting a
              different endpoint — now fixed to check admin/public endpoints.)
            </div>
          ) : (
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((s) => (
                <li key={s.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">
                        <a
                          className="underline"
                          href={`/events/${encodeURIComponent(s.id)}`}
                        >
                          {s.label}
                        </a>
                      </div>
                      {s.description ? (
                        <p className="text-sm text-neutral-600 mt-1">
                          {s.description}
                        </p>
                      ) : null}
                    </div>
                    {s.is_active ? (
                      <span className="text-xs text-green-600">• active</span>
                    ) : (
                      <span className="text-xs text-neutral-400">inactive</span>
                    )}
                  </div>
                  <div className="mt-3 text-sm">
                    <a
                      className="underline"
                      href={`/events/${encodeURIComponent(s.id)}`}
                    >
                      View series →
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
