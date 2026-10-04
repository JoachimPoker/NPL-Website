import { Check } from "lucide-react";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const revalidate = 0;

export default async function AdminPlayersPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createSupabaseServerClient();

  // 1. Auth Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 2. Query
  const q = (sp.q || "").trim();
  const page = Number(sp.page || 1);
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Admins see real names (and consent) here; the public site masks players without consent.
  let query = supabase
    .from("players")
    .select("id, forename, surname, display_name, gdpr, lifetime_cashes, lifetime_money_won", { count: "exact" })
    .order("lifetime_money_won", { ascending: false, nullsFirst: false })
    .order("id")
    .range(from, to);

  if (q) {
    query = query.or(`forename.ilike.%${q}%,surname.ilike.%${q}%,display_name.ilike.%${q}%`);
  }

  const { data: players, count } = await query;
  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize);

  const gbp = (n: number | null) => (n ? `£${Math.round(n).toLocaleString("en-GB")}` : "–");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <div className="border-b border-base-content/[0.07] pb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Players</h1>
        <p className="max-w-2xl text-sm text-base-content/60">
          Everyone in the reports, biggest winners first. Players without GDPR consent are shown by initials on the site.
        </p>
      </div>

      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name…"
          className="input input-bordered input-sm w-full max-w-md"
          aria-label="Search players"
        />
        <button className="btn btn-primary btn-sm">Search</button>
        {q && <Link href="/admin/players" className="btn btn-ghost btn-sm">Clear</Link>}
      </form>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th className="pl-6">Player</th>
                <th className="hidden text-right sm:table-cell">Cashes</th>
                <th className="hidden text-right sm:table-cell">Winnings</th>
                <th className="text-center">Consent</th>
                <th className="pr-6 text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {!players?.length ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-base-content/50">No players found.</td>
                </tr>
              ) : (
                players.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-base-content/[0.03]">
                    <td className="pl-6">
                      <Link href={`/admin/players/${p.id}`} className="font-medium hover:text-primary">
                        {[p.forename, p.surname].filter(Boolean).join(" ") || "Unknown player"}
                      </Link>
                      {p.display_name && <div className="text-xs text-base-content/50">shown as {p.display_name}</div>}
                    </td>
                    <td className="hidden text-right font-mono text-sm sm:table-cell">{p.lifetime_cashes ?? 0}</td>
                    <td className="hidden text-right font-mono text-sm sm:table-cell">{gbp(p.lifetime_money_won)}</td>
                    <td className="text-center">
                      {p.gdpr ? <Check size={16} className="text-season-up" aria-label="Consent given" /> : <span className="text-[0.8125rem] text-season-muted">initials</span>}
                    </td>
                    <td className="pr-6 text-right">
                      <Link href={`/admin/players/${p.id}`} className="btn btn-ghost btn-xs">Edit</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-base-content/[0.07] px-6 py-3">
          <span className="text-xs text-base-content/50">{total.toLocaleString("en-GB")} players</span>
          <div className="join">
            <Link
              href={`?q=${encodeURIComponent(q)}&page=${page - 1}`}
              className={`join-item btn btn-xs btn-ghost ${page <= 1 ? "btn-disabled" : ""}`}
              aria-label="Previous page"
            >
              «
            </Link>
            <span className="join-item btn btn-xs btn-ghost pointer-events-none">Page {page} of {Math.max(totalPages, 1)}</span>
            <Link
              href={`?q=${encodeURIComponent(q)}&page=${page + 1}`}
              className={`join-item btn btn-xs btn-ghost ${page >= totalPages ? "btn-disabled" : ""}`}
              aria-label="Next page"
            >
              »
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
