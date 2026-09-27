// src/app/players/page.tsx
import Link from "next/link";
import { pageMeta } from "@/lib/site";
import { Search, Trophy } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Initial } from "@/components/HomeLeaderboard";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { displayName } from "@/lib/nameMask";

export const metadata = pageMeta({ title: "Players", description: "Every player in the league, ranked by winnings, wins, cashes and more.", path: "/players" });
export const revalidate = 300;

const PAGE_SIZE = 50;

const SORTS = {
  money: { label: "Winnings", column: "lifetime_money_won", ascending: false },
  wins: { label: "Wins", column: "lifetime_wins", ascending: false },
  cashes: { label: "Cashes", column: "lifetime_events_played", ascending: false },
  ft: { label: "Final tables", column: "lifetime_final_tables", ascending: false },
  badges: { label: "Badges", column: "badge_count", ascending: false },
  name: { label: "Name", column: "surname", ascending: true },
} as const;
type SortKey = keyof typeof SORTS;

type Row = {
  id: number;
  forename: string | null;
  surname: string | null;
  display_name: string | null;
  gdpr: boolean | null;
  lifetime_events_played: number | null;
  lifetime_wins: number | null;
  lifetime_final_tables: number | null;
  lifetime_money_won: number | null;
  badge_count: number | null;
};

const gbp = (n: number | null) => `£${Math.round(Number(n || 0)).toLocaleString("en-GB")}`;

function href(params: { q?: string; sort?: string; page?: number }) {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.sort && params.sort !== "money") p.set("sort", params.sort);
  if (params.page && params.page > 1) p.set("page", String(params.page));
  const s = p.toString();
  return `/players${s ? `?${s}` : ""}`;
}

export default async function PlayersPage(props: { searchParams: Promise<{ q?: string; page?: string; sort?: string }> }) {
  const sp = await props.searchParams;
  const q = (sp.q || "").trim();
  const sort: SortKey = (sp.sort && sp.sort in SORTS ? sp.sort : "money") as SortKey;
  const page = Math.max(1, Number(sp.page || 1));
  const from = (page - 1) * PAGE_SIZE;
  const cfg = SORTS[sort];

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("players")
    .select(
      "id, forename, surname, display_name, gdpr, lifetime_events_played, lifetime_wins, lifetime_final_tables, lifetime_money_won, badge_count",
      { count: "exact" }
    )
    // Skip placeholder records whose names have no letters.
    .or("forename.imatch.[a-z],surname.imatch.[a-z]")
    .order(cfg.column, { ascending: cfg.ascending, nullsFirst: false });
  if (sort !== "name") query = query.order("lifetime_money_won", { ascending: false, nullsFirst: false });
  query = query.order("forename", { ascending: true }).range(from, from + PAGE_SIZE - 1);

  if (q) {
    // Players without GDPR consent can't be found by name.
    query = query.eq("gdpr", true).or(`display_name.ilike.%${q}%,forename.ilike.%${q}%,surname.ilike.%${q}%`);
  }

  const { data, count, error } = await query;
  const rows = ((data || []) as Row[]).map((r) => ({
    ...r,
    name: displayName(r.forename, r.surname, !!r.gdpr, r.display_name),
  }));
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const ranked = sort !== "name" && !q;
  const podium = ranked && page === 1 ? rows.slice(0, 3) : [];

  const statFor = (r: Row) => {
    switch (sort) {
      case "wins": return `${r.lifetime_wins ?? 0} wins`;
      case "cashes": return `${r.lifetime_events_played ?? 0} cashes`;
      case "ft": return `${r.lifetime_final_tables ?? 0} final tables`;
      case "badges": return `${r.badge_count ?? 0} badges`;
      default: return gbp(r.lifetime_money_won);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Players"
        title="Every player, ranked"
        description={`${total.toLocaleString("en-GB")} ${q ? `player${total === 1 ? "" : "s"} matching “${q}”` : "players with recorded results"}. Career totals across every season.`}
        actions={
          <form action="/players" className="w-full md:w-80">
            {sort !== "money" && <input type="hidden" name="sort" value={sort} />}
            <label className="input w-full bg-base-100">
              <Search size={16} className="text-base-content/40" aria-hidden="true" />
              <input type="search" name="q" defaultValue={q} placeholder="Search by name" aria-label="Search players by name" />
            </label>
          </form>
        }
      />

      <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label="Sort players" className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {(Object.keys(SORTS) as SortKey[]).map((key) => (
            <Link
              key={key}
              href={href({ q, sort: key })}
              aria-current={sort === key ? "true" : undefined}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors ${
                sort === key
                  ? "bg-primary text-primary-content ring-primary"
                  : "bg-base-100 text-base-content/65 ring-base-content/10 hover:text-base-content"
              }`}
            >
              {SORTS[key].label}
            </Link>
          ))}
        </nav>

        {podium.length === 3 && (
          <section aria-label={`Top 3 by ${SORTS[sort].label.toLowerCase()}`} className="grid gap-4 sm:grid-cols-3">
            {podium.map((r, i) => (
              <Link
                key={r.id}
                href={`/players/${r.id}`}
                className={`panel group flex items-center gap-4 p-5 transition-colors hover:border-primary/40 ${i === 0 ? "ring-1 ring-primary/30" : ""}`}
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-mono text-lg font-bold ${
                  i === 0 ? "bg-primary text-primary-content" : "bg-base-200 text-base-content/70"
                }`}>
                  {i === 0 ? <Trophy size={20} aria-hidden="true" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-lg font-semibold transition-colors group-hover:text-primary">{r.name}</span>
                  <span className="block font-mono text-sm text-base-content/60">{statFor(r)}</span>
                </span>
              </Link>
            ))}
          </section>
        )}

        <section className="panel overflow-hidden" aria-label="Players">
          {error ? (
            <p className="px-6 py-16 text-center text-base-content/55">Couldn&apos;t load players. Please try again.</p>
          ) : rows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="font-display text-lg">No players match “{q}”</div>
              <p className="mt-1 text-sm text-base-content/50">Try part of a first or last name.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    {ranked && <th className="w-14 pl-6 text-center">#</th>}
                    <th className={ranked ? "" : "pl-6"}>Player</th>
                    <th className={`text-right ${sort === "cashes" ? "text-primary" : ""}`}>Cashes</th>
                    <th className={`hidden text-right sm:table-cell ${sort === "wins" ? "text-primary" : ""}`}>Wins</th>
                    <th className={`hidden text-right md:table-cell ${sort === "ft" ? "text-primary" : ""}`}>FTs</th>
                    <th className={`hidden text-right md:table-cell ${sort === "badges" ? "text-primary" : ""}`}>Badges</th>
                    <th className={`pr-6 text-right ${sort === "money" ? "text-primary" : ""}`}>Winnings</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} className="transition-colors hover:bg-base-content/[0.03]">
                      {ranked && <td className="pl-6 text-center font-mono text-sm text-base-content/45">{from + i + 1}</td>}
                      <td className={ranked ? "" : "pl-6"}>
                        <Link href={`/players/${r.id}`} className="group flex items-center gap-3 font-medium">
                          <Initial name={r.name} muted={!r.gdpr} />
                          <span className="truncate transition-colors group-hover:text-primary">{r.name}</span>
                        </Link>
                      </td>
                      <td className="text-right font-mono text-sm">{r.lifetime_events_played ?? 0}</td>
                      <td className="hidden text-right font-mono text-sm sm:table-cell">{r.lifetime_wins || "–"}</td>
                      <td className="hidden text-right font-mono text-sm md:table-cell">{r.lifetime_final_tables || "–"}</td>
                      <td className="hidden text-right font-mono text-sm md:table-cell">{r.badge_count || "–"}</td>
                      <td className="pr-6 text-right font-mono text-sm font-semibold">{gbp(r.lifetime_money_won)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-base-content/[0.07] px-6 py-4">
              <div className="text-sm text-base-content/50">Page {page} of {totalPages.toLocaleString("en-GB")}</div>
              <div className="join">
                <Link href={href({ q, sort, page: page - 1 })} aria-disabled={page <= 1} className={`join-item btn btn-sm ${page <= 1 ? "btn-disabled" : "btn-ghost"}`}>Previous</Link>
                <Link href={href({ q, sort, page: page + 1 })} aria-disabled={page >= totalPages} className={`join-item btn btn-sm ${page >= totalPages ? "btn-disabled" : "btn-ghost"}`}>Next</Link>
              </div>
            </div>
          )}
        </section>

        <p className="text-xs text-base-content/40">
          Players who haven&apos;t agreed to show their name appear as initials and can&apos;t be found by searching.
        </p>
      </div>
    </>
  );
}
