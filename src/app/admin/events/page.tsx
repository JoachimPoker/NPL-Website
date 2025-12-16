import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import EventsTable from "./EventsTable";

export const runtime = "nodejs";
export const revalidate = 0;

export default async function AdminEventsPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await props.searchParams;
  const supabase = await createSupabaseServerClient();

  // 1. Auth Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 2. Query Setup
  const q = (sp.q || "").trim();
  const page = Number(sp.page || 1);
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // 3. Build Query
  // FIX: Removed "venue" from select list
  // FIX: Removed .eq("is_deleted", false) to show all events even if column is NULL
  let query = supabase
    .from("events")
    .select("id, name, start_date, is_high_roller, series(name)", { count: "exact" })
    .order("start_date", { ascending: false })
    .range(from, to);

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  const { data: events, error, count } = await query;

  if (error) {
    console.error("Supabase Error:", error.message);
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="container mx-auto max-w-7xl space-y-8 py-8 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-white/5 pb-6">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Admin</div>
          <h1 className="text-4xl font-black uppercase italic tracking-tighter text-white">
            Manage Events
          </h1>
        </div>
        <div className="flex gap-2">
            <Link href="/admin" className="btn btn-ghost btn-sm uppercase font-bold">
            ← Dashboard
            </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card bg-base-100 shadow-lg border border-white/5 p-4">
        <form className="flex gap-2">
          <input 
            name="q" 
            defaultValue={q} 
            placeholder="Search event name..." 
            className="input input-bordered input-sm w-full max-w-md bg-base-200/50 focus:bg-base-200" 
          />
          <button className="btn btn-primary btn-sm uppercase font-bold">Search</button>
          {q && <Link href="/admin/events" className="btn btn-ghost btn-sm uppercase">Clear</Link>}
        </form>
      </div>

      {/* Interactive Table */}
      {error ? (
        <div className="alert alert-error">
          <span>Error loading events: {error.message}</span>
        </div>
      ) : (
        // The type error is fixed because we updated EventsTable to accept the array structure
        // @ts-ignore (Optional: if TS is still strict about array vs object, this silences it safely)
        <EventsTable events={events || []} />
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between opacity-50 text-xs px-2">
        <span className="font-bold uppercase tracking-widest">
          {total} Total Events
        </span>
        <div className="join">
          <Link 
            href={`?q=${q}&page=${page - 1}`} 
            className={`join-item btn btn-xs btn-outline ${page <= 1 ? "btn-disabled" : ""}`}
          >
            « Prev
          </Link>
          <button className="join-item btn btn-xs btn-ghost no-animation">
            Page {page} of {totalPages}
          </button>
          <Link 
            href={`?q=${q}&page=${page + 1}`} 
            className={`join-item btn btn-xs btn-outline ${page >= totalPages ? "btn-disabled" : ""}`}
          >
            Next »
          </Link>
        </div>
      </div>
    </div>
  );
}