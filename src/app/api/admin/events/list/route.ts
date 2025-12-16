import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const festivalId = searchParams.get("festival_id");
    const unassignedOnly = searchParams.get("unassigned_only") === "1";
    const seriesId = searchParams.get("series_id");
    
    // Smart Filter Params
    const minDate = searchParams.get("min_date");
    const maxDate = searchParams.get("max_date");
    const keywords = searchParams.get("keywords"); // comma separated

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
    
    let query = supabase
      .from("events")
      .select("id, name, start_date, is_high_roller, series_id, festival_id")
      .order("start_date", { ascending: true }); // Ascending makes sense for a schedule list

    // --- 1. Standard Filters ---
    if (festivalId) {
      query = query.eq("festival_id", festivalId);
    } 
    else if (seriesId) {
      query = query.eq("series_id", seriesId);
    }
    
    // --- 2. Smart "Unassigned" Filter ---
    if (unassignedOnly) {
      query = query.is("festival_id", null);

      // Filter by Date Range
      if (minDate && maxDate) {
        // Buffer the dates slightly? Or strict? User asked for strict range.
        query = query.gte("start_date", minDate).lte("start_date", maxDate);
      }

      // Filter by Keywords (OR logic: GUKPT or Coventry)
      if (keywords) {
        const terms = keywords.split(",").map(k => k.trim()).filter(Boolean);
        if (terms.length > 0) {
          // Construct an OR filter: name.ilike.%Term1%,name.ilike.%Term2%
          const orClause = terms.map(term => `name.ilike.%${term}%`).join(",");
          query = query.or(orClause);
        }
      }
    }

    // Limit results
    query = query.limit(200);

    const { data, error } = await query;

    if (error) {
      console.error("DB Error events/list:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, results: data });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}