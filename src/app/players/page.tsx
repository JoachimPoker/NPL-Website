// src/app/players/page.tsx
import { headers } from "next/headers";

export const runtime = "nodejs";
export const revalidate = 0;

type PlayerRowUI = {
  id: string;
  name: string;
  joined_at?: string;
};

type ListRespAny = any;

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

function cleanHref(params: Record<string, string | number | undefined>) {
  const clean: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined) clean[k] = v as any;
  const usp = new URLSearchParams(clean as any).toString();
  return `/players?${usp}`;
}

function parseParams(searchParams: Record<string, string | string[] | undefined>) {
  const get = (k: string, d = "") =>
    (Array.isArray(searchParams[k]) ? searchParams[k]?.[0] : searchParams[k]) ?? d;

  const q = get("q", "");
  const pageNum = Number(get("page", "1"));
  const limitNum = Number(get("limit", "25"));
  const sort = get("sort", "name"); // name | joined
  const dir = get("dir", "asc");    // asc | desc

  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;
  const limit = Number.isFinite(limitNum) && limitNum > 0 ? Math.min(limitNum, 200) : 25;

  return { q, page, limit, sort, dir };
}

// ---- Normalizer: adapt to your API no matter the keys (no ??/|| mixing) ----
function normalizePlayers(resp: ListRespAny): {
  players: PlayerRowUI[];
  total?: number;
  page: number;
  limit: number;
  hasMoreHint?: boolean;
} {
  const baseArray: any =
    (Array.isArray(resp) ? resp : undefined) ??
    resp?.players ??
    resp?.items ??
    resp?.rows ??
    resp?.data ??
    [];

  const players: PlayerRowUI[] = (Array.isArray(baseArray) ? baseArray : []).map((p: any) => {
    const idPart = p?.id ?? p?.player_id ?? p?.slug ?? p?.uuid ?? p?._id ?? p?.member_id ?? "";
    const id = String(idPart);

    let nameRaw: string | undefined = p?.name as string | undefined;
    if (nameRaw === undefined) {
      const first = (p?.forename as string | undefined) ?? (p?.first_name as string | undefined) ?? "";
      const last  = (p?.surname as string | undefined) ?? (p?.last_name as string | undefined) ?? "";
      const combo = `${first} ${last}`.trim();
      nameRaw = combo.length > 0 ? combo : undefined;
    }
    const name = (nameRaw !== undefined && nameRaw.length > 0) ? nameRaw : "Unknown";

    const joinedRaw =
      p?.joined_at ?? p?.created_at ?? p?.createdAt ?? p?.signup_date ?? p?.joined ?? undefined;
    const joined_at = joinedRaw !== undefined ? String(joinedRaw) : undefined;

    return { id, name, joined_at };
  });

  const totalField = resp?.total ?? resp?.count ?? resp?.total_count;
  const totalNum = Number(totalField);
  const total = Number.isFinite(totalNum) ? totalNum : undefined;

  const pageField = resp?.page ?? resp?.page_index ?? 1;
  const pageNum = Number(pageField);
  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;

  const limitField = resp?.limit ?? resp?.page_size ?? 25;
  const limitNum = Number(limitField);
  const limit = Number.isFinite(limitNum) && limitNum > 0 ? limitNum : 25;

  const hasMoreHint =
    Boolean(resp?.has_more) ||
    Boolean(resp?.hasNextPage) ||
    typeof resp?.next_cursor === "string" ||
    typeof resp?.nextPageToken === "string";

  return { players, total, page, limit, hasMoreHint };
}

/* sorting */
function sortPlayers(rows: PlayerRowUI[], sort: string, dir: string): PlayerRowUI[] {
  const copy = rows.slice();
  const asc = dir !== "desc";
  copy.sort((a, b) => {
    if (sort === "joined") {
      const ad = a.joined_at ? new Date(a.joined_at).getTime() : 0;
      const bd = b.joined_at ? new Date(b.joined_at).getTime() : 0;
      if (ad < bd) return asc ? -1 : 1;
      if (ad > bd) return asc ? 1 : -1;
      return 0;
    } else {
      const an = a.name.toLowerCase();
      const bn = b.name.toLowerCase();
      if (an < bn) return asc ? -1 : 1;
      if (an > bn) return asc ? 1 : -1;
      return 0;
    }
  });
  return copy;
}

function SortLink({
  label,
  sortKey,
  currentSort,
  currentDir,
  params,
  alignRight,
}: {
  label: string;
  sortKey: string;
  currentSort: string;
  currentDir: string;
  params: any;
  alignRight?: boolean;
}) {
  const isActive = currentSort === sortKey;
  const dir = isActive ? (currentDir === "asc" ? "desc" : "asc") : "asc";
  const href = cleanHref({ ...params, sort: sortKey, dir });
  return (
    <a
      className={`hover:underline ${alignRight ? "text-right block" : ""} ${isActive ? "font-semibold" : ""}`}
      href={href}
      title={`Sort by ${label}`}
    >
      {label}
      {isActive ? (currentDir === "asc" ? " ▲" : " ▼") : ""}
    </a>
  );
}

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { q, page, limit, sort, dir } = parseParams(searchParams);

  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  qs.set("page", String(page));
  qs.set("limit", String(limit));

  const raw = await fetchJSON<ListRespAny>(`/api/players/list?${qs.toString()}`);
  const { players, total, page: gotPage, limit: gotLimit, hasMoreHint } = normalizePlayers(raw ?? {});

  const effectiveLimit = gotLimit || limit;

  const knownTotal = typeof total === "number" && Number.isFinite(total);
  const totalPages = knownTotal ? Math.max(1, Math.ceil((total as number) / effectiveLimit)) : undefined;

  const hasPrev = gotPage > 1;
  const fullPage = players.length >= effectiveLimit;
  const hasNext = knownTotal ? (gotPage < (totalPages as number)) : (fullPage || !!hasMoreHint);

  const sorted = sortPlayers(players, sort, dir);

  const baseParams = { q, page: gotPage, limit: effectiveLimit, sort, dir };

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden">
        <div className="card-header flex flex-wrap items-center justify-between gap-2">
          <div>Players</div>
          <form action="/players" method="get" className="flex items-center gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Search by name or alias..."
              className="w-64 rounded-md border px-3 py-1.5 text-sm"
            />
            <label className="text-sm inline-flex items-center gap-1">
              <span className="text-neutral-600">Limit:</span>
              <select
                name="limit"
                defaultValue={String(effectiveLimit)}
                className="rounded-md border px-2 py-1 text-sm"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </label>
            <button className="rounded-md border px-3 py-1.5 text-sm" type="submit">
              Apply
            </button>
          </form>
        </div>

        <div className="card-body">
          <p className="text-sm text-neutral-600 mb-3">
            {knownTotal ? `${total} players` : `${sorted.length}${fullPage ? "+" : ""} players`}
          </p>

          {!sorted.length ? (
            <div className="text-sm text-neutral-600">No players found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="text-left">
                      <SortLink label="Player" sortKey="name" currentSort={sort} currentDir={dir} params={baseParams} />
                    </th>
                    <th className="text-left">
                      <SortLink label="Joined" sortKey="joined" currentSort={sort} currentDir={dir} params={baseParams} />
                    </th>
                    <th className="text-left">Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <a className="underline" href={`/players/${encodeURIComponent(p.id)}`}>
                          {p.name}
                        </a>
                      </td>
                      <td>{p.joined_at ? p.joined_at.slice(0, 10) : ""}</td>
                      <td>
                        <a className="underline" href={`/players/${encodeURIComponent(p.id)}`}>
                          View profile →
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="mt-4 flex items-center gap-2 text-sm">
            <a
              className={`border rounded px-2 py-1 ${!hasPrev ? "pointer-events-none opacity-50" : ""}`}
              href={hasPrev ? cleanHref({ q, page: Math.max(1, gotPage - 1), limit: effectiveLimit, sort, dir }) : undefined}
            >
              ← Prev
            </a>

            {knownTotal ? (
              <span className="text-neutral-600">
                Page {gotPage} of {totalPages}
              </span>
            ) : (
              <span className="text-neutral-600">Page {gotPage}</span>
            )}

            <a
              className={`border rounded px-2 py-1 ${!hasNext ? "pointer-events-none opacity-50" : ""}`}
              href={hasNext ? cleanHref({ q, page: gotPage + 1, limit: effectiveLimit, sort, dir }) : undefined}
            >
              Next →
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
