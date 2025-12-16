import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const seriesId = searchParams.get("series_id");
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
             try {
                cookiesToSet.forEach(({ name, value, options }) =>
                   cookieStore.set(name, value, options)
                )
             } catch { /* ignore */ }
          },
        },
      }
    );
    
    let query = supabase.from("festivals").select("*").order("start_date", { ascending: true });

    if (seriesId) {
      query = query.eq("series_id", seriesId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("DB Error /admin/festivals/list:", error);
      return NextResponse.json({ ok: false, _error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ ok: true, festivals: data });

  } catch (e: any) {
    console.error("Crash /admin/festivals/list:", e);
    return NextResponse.json({ ok: false, _error: e.message }, { status: 500 });
  }
}