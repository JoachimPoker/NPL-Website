// src/app/admin/series/page.tsx
import { headers } from "next/headers";

export const runtime = "nodejs";
export const revalidate = 0;

type AdminSeries = {
  id: string;
  name: string;
  slug?: string | null;
  keywords?: string | null;
  is_active: boolean;
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

/** Similar multi-endpoint loader, but biased to admin endpoints. */
async function loadAdminSeries(): Promise<AdminSeries[]> {
  const candidates = [
    "/api/admin/series/list",
    "/api/admin/series",
    "/api/series/list",
    "/api/series",
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

    if (Array.isArray(raw)) {
      return raw.map((s: any) => ({
        id: String(s.id ?? s.series_id ?? s.slug ?? s.key ?? ""),
        name: String(s.name ?? s.label ?? s.title ?? "Series"),
        slug:
          typeof s.slug === "string"
            ? s.slug
            : typeof s.key === "string"
            ? s.key
            : null,
        keywords:
          typeof s.keywords === "string"
            ? s.keywords
            : Array.isArray(s.keywords)
            ? s.keywords.join(", ")
            : null,
        is_active: Boolean(s.is_active ?? s.active ?? s.enabled ?? true),
      }));
    }
  }
  return [];
}

function Button({ children, href, subtle }: { children: React.ReactNode; href?: string; subtle?: boolean }) {
  const cls = subtle
    ? "rounded-md border px-2 py-1 text-sm"
    : "rounded-md border px-3 py-1.5 text-sm";
  return href ? (
    <a className={cls} href={href}>
      {children}
    </a>
  ) : (
    <span className={`${cls} opacity-50 pointer-events-none`}>{children}</span>
  );
}

export default async function AdminSeriesPage() {
  const rows = await loadAdminSeries();

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Admin — Series</h1>
          <div className="flex items-center gap-2">
            <a className="rounded-md border px-3 py-1.5 text-sm" href="/admin/seasons">
              Seasons
            </a>
            <a className="rounded-md border px-3 py-1.5 text-sm" href="/admin/import">
              Import
            </a>
            <a className="rounded-md border px-3 py-1.5 text-sm" href="/admin/series/auto-assign">
              Auto-assign all
            </a>
            <a className="rounded-md border px-3 py-1.5 text-sm" href="/admin/series/new">
              + New Series
            </a>
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="card overflow-x-auto">
        <div className="card-header">Series</div>
        {!rows.length ? (
          <div className="card-body text-sm text-neutral-600">No series yet.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th className="text-left">Name</th>
                <th className="text-left">Slug</th>
                <th className="text-left">Keywords</th>
                <th className="text-left">Active</th>
                <th className="text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td className="font-medium">{s.name}</td>
                  <td>{s.slug ?? ""}</td>
                  <td className="text-neutral-600">{s.keywords ?? ""}</td>
                  <td>
                    {s.is_active ? (
                      <span className="badge border-green-300 text-green-700 bg-green-50">Active</span>
                    ) : (
                      <span className="badge border-neutral-300 text-neutral-700 bg-neutral-50">Inactive</span>
                    )}
                  </td>
                  <td className="space-x-2 whitespace-nowrap">
                    <Button href={`/admin/series/${encodeURIComponent(s.id)}`}>Manage</Button>
                    <Button href={`/admin/series/${encodeURIComponent(s.id)}/edit`} subtle>
                      Edit
                    </Button>
                    <Button href={`/admin/series/${encodeURIComponent(s.id)}/delete`} subtle>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
