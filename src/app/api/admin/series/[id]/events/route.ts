import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const revalidate = 0;

const bad = (code: number, msg: string) =>
  NextResponse.json({ ok: false, _error: msg }, { status: code });

function isValidId(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const n = Number(v);
  return Number.isFinite(n) && n >= 1;
}

type EventRow = {
  id: string | number;
  tournament_name?: string | null; // ✅ Changed to match alias
  start_date?: string | null;
  festival_id?: string | null;
  series_id?: number | null;
  is_deleted?: boolean | null;
  search_text?: string | null;
};

async function requireAdmin() {
  const supabase = await createSupabaseRouteClient();
  const { data: ures, error: uerr } = await supabase.auth.getUser();
  if (uerr || !ures?.user)
    return { supabase, ok: false as const, status: 401, msg: "Unauthorized" };

  const roles: string[] =
    ((ures.user?.app_metadata as any)?.roles as string[]) || [];
  const isAdmin =
    roles.includes("admin") ||
    (ures.user?.app_metadata as any)?.role === "admin" ||
    (ures.user?.user_metadata as any)?.is_admin === true;

  if (!isAdmin)
    return { supabase, ok: false as const, status: 403, msg: "Forbidden" };
  return { supabase, ok: true as const };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!isValidId(id)) return bad(400, "Missing/invalid series id");
    const seriesId = Number(id);

    const admin = await requireAdmin();
    if (!admin.ok) return bad(admin.status, admin.msg);
    const supabase = admin.supabase;

    const { data: srow, error: serr } = await supabase
      .from("series")
      .select("id, slug, name")
      .eq("id", seriesId)
      .maybeSingle();
    if (serr) return bad(500, serr.message);
    if (!srow) return bad(404, "Series not found");

    const url = new URL(_req.url);
    const qParam = (url.searchParams.get("q") || "").trim();
    const unassignedOnly = url.searchParams.get("unassigned_only") === "1";
    const limit = Math.max(
      1,
      Math.min(500, Number(url.searchParams.get("limit") ?? 100))
    );
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));

    const seriesTermRaw = (srow.slug || srow.name || "").trim();
    const esc = (s: string) => s.replace(/([,()])/g, "\\$1");
    const likeSeries = `%${esc(seriesTermRaw)}%`;

    // ✅ FIX: Aliased 'name' to 'tournament_name' directly in SQL
    let qb = supabase
      .from("events")
      .select("id, tournament_name:name, start_date, festival_id, series_id, is_deleted, search_text", {
        count: "exact",
      })
      .eq("is_deleted", false);

    if (unassignedOnly) {
      qb = qb
        .is("series_id", null)
        .or(`name.ilike.${likeSeries},search_text.ilike.${likeSeries}`);
    } else {
      qb = qb.or(
        [
          `and(series_id.eq.${seriesId})`,
          `and(series_id.is.null,name.ilike.${likeSeries})`,
          `and(series_id.is.null,search_text.ilike.${likeSeries})`,
        ].join(",")
      );
    }

    if (qParam) {
      const likeQ = `%${esc(qParam)}%`;
      qb = qb.or(`name.ilike.${likeQ},search_text.ilike.${likeQ}`);
    }

    qb = qb
      .order("start_date", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await qb;
    if (error) return bad(500, error.message);

    const rows = (data ?? []) as EventRow[];
    
    // Map result
    const results = rows.map((r) => ({
      id: String(r.id),
      tournament_name: r.tournament_name || null, // ✅ Using the alias directly
      start_date: r.start_date ? String(r.start_date).slice(0, 10) : null,
      festival_id: r.festival_id ?? null,
      series_id: r.series_id ?? null,
    }));

    return NextResponse.json({
      ok: true,
      results,
      total: typeof count === "number" ? count : results.length,
    });
  } catch (e: any) {
    return bad(500, e?.message || "Unexpected error");
  }
}