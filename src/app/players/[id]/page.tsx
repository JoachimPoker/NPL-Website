import Link from "next/link";
import { headers } from "next/headers";

async function apiFetch(pathWithQuery: string) {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const url = `${proto}://${host}${pathWithQuery}`;
  return fetch(url, { cache: "no-store" });
}

async function fetchPlayer(id: string) {
  const res = await apiFetch(`/api/players/${id}`);
  if (!res.ok) throw new Error("Player not found");
  return res.json();
}

export default async function PlayerProfile({ params }: { params: { id: string } }) {
  const data = await fetchPlayer(params.id);
  const p = data.player;

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.avatar_url ? (
          <img src={p.avatar_url} alt="" className="h-16 w-16 rounded-full" />
        ) : (
          <div className="h-16 w-16 rounded-full border" />
        )}
        <div>
          <h1 className="text-2xl font-semibold">{p.name}</h1>
          <div className="text-sm opacity-70">{p.consent ? "Consent: Yes" : "Consent: No"}</div>
        </div>
      </div>

      <section className="rounded-2xl border p-4">
        <h2 className="mb-2 font-semibold">Stats</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border p-3">
            <div className="text-sm opacity-70">Lifetime points</div>
            <div className="text-xl font-semibold">{data.stats.lifetime_points}</div>
          </div>
          <div className="rounded-xl border p-3">
            <div className="text-sm opacity-70">Recent results</div>
            <div className="text-xl font-semibold">{data.stats.recent_results_count}</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border p-4">
        <h2 className="mb-3 font-semibold">Recent results</h2>
        <ul className="space-y-2">
          {data.recent_results.map((r: any) => (
            <li key={r.id} className="rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{r.event?.name || "Event"}</div>
                <div className="text-sm opacity-70">
                  {r.event?.start_date ? new Date(r.event.start_date).toLocaleDateString() : ""}
                </div>
              </div>
              <div className="text-sm opacity-80">
                {r.points ?? 0} pts • {r.prize_amount ? `£${r.prize_amount}` : "–"} •{" "}
                {typeof r.position_of_prize === "number" ? `#${r.position_of_prize}` : "—"}
              </div>
              <div className="text-xs opacity-60">
                {r.event?.site_name ? `Site: ${r.event.site_name}` : ""}
                {r.event?.buy_in_raw ? ` • Buy-in: ${r.event.buy_in_raw}` : ""}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Link href="/players" className="inline-block rounded-xl border px-3 py-2">
        ← Back to players
      </Link>
    </main>
  );
}
