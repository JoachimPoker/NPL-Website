import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";
export const revalidate = 0; // Disable caching

export async function GET() {
  try {
    const cookieStore = await cookies();

    // Manually create client to ensure it works
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
            } catch { /* ignore set in GET */ }
          },
        },
      }
    );

    // Fetch data
    const { data, error } = await supabase
      .from("series")
      .select("*") // Use * to avoid errors if specific columns like 'slug' are missing
      .order("name", { ascending: true });

    if (error) {
      console.error("DB Error /admin/series/list:", error);
      return NextResponse.json({ ok: false, _error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ ok: true, series: data });

  } catch (e: any) {
    console.error("Crash /admin/series/list:", e);
    return NextResponse.json({ ok: false, _error: e.message }, { status: 500 });
  }
}