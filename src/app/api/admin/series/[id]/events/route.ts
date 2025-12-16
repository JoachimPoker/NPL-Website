import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { id } = params; 
    const { searchParams } = new URL(req.url);
    
    const limit = Number(searchParams.get("limit") || 100);
    const offset = Number(searchParams.get("offset") || 0);
    const q = (searchParams.get("q") || "").trim();
    const unassignedOnly = searchParams.get("unassigned_only") === "1";

    // Initialize Supabase manually to prevent crash
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) { try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} },
        },
      }
    );

    // 1. Build Query
    // ⚠️ FIX: Select 'name' (correct), not 'tournament_name' (incorrect)
    let query = supabase
      .from("events")
      .select("id, name, start_date, series_id, festival_id", { count: "exact" })
      .order("start_date", { ascending: false })
      .range(offset, offset + limit - 1);

    // 2. Apply Filters
    if (unassignedOnly) {
      query = query.or(`series_id.eq.${id},series_id.is.null`);
    } else {
      query = query.eq("series_id", id);
    }

    if (q) {
      query = query.ilike("name", `%${q}%`); // ⚠️ FIX: Filter on 'name'
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("DB Error events list:", error);
      return NextResponse.json({ ok: false, _error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, results: data, total: count });

  } catch (e: any) {
    console.error("API Crash:", e);
    return NextResponse.json({ ok: false, _error: e.message }, { status: 500 });
  }
}

// Handle Bulk Updates
export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { id } = params;
    const body = await req.json();
    const { event_ids, op } = body; 

    if (!event_ids?.length) return NextResponse.json({ ok: false }, { status: 400 });

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) { try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} },
        },
      }
    );
    
    const updateData = { series_id: op === 'clear' ? null : Number(id) };

    const { error, count } = await supabase
      .from("events")
      .update(updateData)
      .in("id", event_ids)
      .select("id", { count: "exact" });

    if (error) return NextResponse.json({ ok: false, _error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, updated_count: count });
  } catch (e: any) {
     return NextResponse.json({ ok: false, _error: e.message }, { status: 500 });
  }
}