import Link from "next/link";
import { headers } from "next/headers";

async function apiFetch(pathWithQuery: string) {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const url = `${proto}://${host}${pathWithQuery}`;
  return fetch(url, { cache: "no-store" });
}

async function fetchPlayers(q: string, page: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", String(page));
  params.set("pageSize", "24");

  const res = await apiFetch(`/api/players?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load players");
  return res.json();
}

export default async function PlayersIndex({
  searchParams,
}: {
  searchParams?: { q?: string; page?: string };
}) {
  const q = searchParams?.q || "";
  const page = Number(searchParams?.page || 1);
  const data = await fetchPlayers(q, page);

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Players</h1>

      <form action="/players" className="flex gap-2">
        <input
          type="text"
          name="q"
          placeholder="Search players…"
          defaultValue={q}
          className="flex-1 rounded-xl border px-3 py-2"
        />
        <button className="rounded-xl border px-4 py-2">Search</button>
      </form>

      <ul className="grid grid-cols-1 divide-y rounded-2xl border md:grid-cols-2 md:divide-y-0 md:divide-x">
        {data.rows.map((p: any) => (
          <li key={p.id} className="flex items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.avatar_url ? (
              <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full" />
            ) : (
              <div className="h-8 w-8 rounded-full border" />
            )}
            <div className="flex-1">
              <Link href={`/players/${p.id}`} className="font-medium hover:underline">
                {p.name}
              </Link>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between">
        <span className="text-sm opacity-70">
          {data.meta.total} total • page {data.meta.page}
        </span>
        <div className="flex gap-2">
          {data.meta.page > 1 && (
            <Link
              href={`/players?${new URLSearchParams({ q, page: String(page - 1) }).toString()}`}
              className="rounded-xl border px-3 py-1"
            >
              Prev
            </Link>
          )}
          {data.meta.page * data.meta.pageSize < data.meta.total && (
            <Link
              href={`/players?${new URLSearchParams({ q, page: String(page + 1) }).toString()}`}
              className="rounded-xl border px-3 py-1"
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
