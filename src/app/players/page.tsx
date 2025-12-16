// src/app/players/page.tsx
import { headers } from "next/headers";
import Link from "next/link";

export const runtime = "nodejs";
export const revalidate = 60;

const PLACEHOLDER_AVATAR_URL = "/avatar-default.svg";

type PlayersResponse = {
  meta: {
    page: number;
    pageSize: number;
    total: number;
    query: string;
  };
  rows: {
    id: string;
    name: string;
    avatar_url: string | null;
    consent: boolean;
  }[];
};

async function baseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export default async function PlayersPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await props.searchParams;
  const q = sp.q || "";
  const page = Number(sp.page || 1);
  const pageSize = 24; 

  // Build API URL
  // We use your existing public API which accepts 'page', 'pageSize', and 'q'
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  const apiUrl = `${await baseUrl()}/api/players?${params.toString()}`;
  
  const res = await fetch(apiUrl, { cache: "no-store" }); 
  const data: PlayersResponse = res.ok 
    ? await res.json() 
    : { meta: { page: 1, pageSize, total: 0, query: "" }, rows: [] };
  
  const players = data.rows || [];
  const total = data.meta.total || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return (
    <div className="container mx-auto max-w-7xl space-y-8 py-8 px-4">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/5 pb-6">
        <div className="w-full md:w-auto">
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">
            Players
          </h1>
          <p className="text-base-content/60 mt-1 font-medium">
            Find player profiles & stats
          </p>
        </div>
        
        <form className="w-full md:w-96">
          <div className="relative">
            <input 
              name="q" 
              defaultValue={q}
              placeholder="Search by name..." 
              className="input input-bordered w-full bg-base-200/50 focus:bg-base-200 pl-10 placeholder:text-base-content/30"
            />
            <span className="absolute left-3 top-3 text-base-content/40">🔍</span>
          </div>
        </form>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {!players.length ? (
          <div className="col-span-full p-12 text-center card bg-base-100 border border-white/5">
            <p className="text-base-content/50 italic">No players found.</p>
            {q && (
               <p className="text-xs text-base-content/40 mt-2">Try checking the spelling or searching for a partial name.</p>
            )}
          </div>
        ) : (
          players.map((p) => {
             const avatarSrc = p.avatar_url || PLACEHOLDER_AVATAR_URL;
             // Generate initials for fallback
             const initials = p.name
                ?.split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((n) => n[0])
                .join("") ?? "?";

             return (
              <Link 
                key={p.id} 
                href={`/players/${p.id}`}
                className="card bg-base-100 shadow-md border border-white/5 hover:border-primary/50 hover:shadow-xl transition-all group flex flex-row items-center p-4 gap-4"
              >
                <div className="avatar">
                  <div className="w-12 h-12 rounded-full bg-base-300 ring ring-white/5 group-hover:ring-primary/50 transition-all overflow-hidden flex items-center justify-center font-bold text-base-content/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.avatar_url ? (
                      <img src={avatarSrc} alt={p.name} className="object-cover" />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate group-hover:text-primary transition-colors text-lg">
                    {p.name}
                  </div>
                  <div className="text-xs text-base-content/50 uppercase tracking-wide font-medium">
                    View Profile
                  </div>
                </div>
                <div className="text-base-content/20 group-hover:text-primary transition-colors font-mono">→</div>
              </Link>
            );
          })
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-col items-center gap-4 pt-8">
        <span className="text-xs font-bold uppercase tracking-widest text-base-content/40">
            Showing {players.length} of {total.toLocaleString()} Players
        </span>
        <div className="join">
          <Link
            href={`/players?q=${q}&page=${page - 1}`}
            className={`join-item btn btn-outline btn-sm uppercase font-bold ${!hasPrev ? "btn-disabled opacity-50" : ""}`}
          >
            ← Prev
          </Link>
          <button className="join-item btn btn-outline btn-sm uppercase font-bold no-animation cursor-default hover:bg-transparent hover:text-base-content">
            Page {page}
          </button>
          <Link
            href={`/players?q=${q}&page=${page + 1}`}
            className={`join-item btn btn-outline btn-sm uppercase font-bold ${!hasNext ? "btn-disabled opacity-50" : ""}`}
          >
            Next →
          </Link>
        </div>
      </div>
    </div>
  );
}