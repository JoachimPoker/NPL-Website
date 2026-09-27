import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isAdminUser } from "@/lib/isAdmin";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

async function getIsAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value, set: () => {}, remove: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  return isAdminUser(user);
}

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await getIsAdmin();
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await req.json();
    
    // --- FIXED LOGIC BASED ON YOUR DEBUG LOG ---
    // Your debug showed: { "updates": [...] }
    // We now check for 'updates', then 'events', then the body itself.
    const events = body.updates || body.events || (Array.isArray(body) ? body : null);

    if (!events || !Array.isArray(events)) {
      console.error("ERROR: Payload is not an array. Received keys:", Object.keys(body));
      return NextResponse.json({ error: "Invalid data format: Expected an array in 'updates'" }, { status: 400 });
    }

    console.log(`DEBUG: Processing ${events.length} event updates...`);

    const adminSupabase = createSupabaseAdminClient();

    // Use a loop to update each event individually to ensure clean NULL handling
    const results = await Promise.all(
      events.map(async (ev: any) => {
        if (!ev.id) return { error: null };

        // Clean values for Postgres
        // Convert "6" (string) to 6 (number) if your DB uses integers for series_id
        const rawSeriesId = ev.series_id && ev.series_id !== "" ? ev.series_id : null;
        const seriesId = (rawSeriesId !== null && !isNaN(Number(rawSeriesId))) 
          ? Number(rawSeriesId) 
          : rawSeriesId;

        // Only touch High Roller when the admin changed it; that choice is then pinned
        // so weekly imports don't recompute it from the tournament name.
        const hr = "is_high_roller" in ev
          ? { is_high_roller: ev.is_high_roller === true || ev.is_high_roller === "true", is_high_roller_locked: true }
          : {};

        // Same for the series: only when sent, and then pinned against auto-detection.
        const series = "series_id" in ev ? { series_id: seriesId, series_locked: true } : {};

        return adminSupabase
          .from("events")
          .update({
            ...series,
            ...hr,
            updated_at: new Date().toISOString()
          })
          .eq("id", ev.id);
      })
    );

    // Check for database errors
    const firstError = results.find(r => r.error)?.error;
    if (firstError) {
      console.error("DATABASE ERROR:", firstError);
      throw new Error(firstError.message);
    }

    return NextResponse.json({ ok: true, message: `Successfully updated ${events.length} events.` });

  } catch (e: any) {
    console.error("BULK UPDATE CRASH:", e.message);
    return NextResponse.json({ error: e.message || "Internal Server Error" }, { status: 500 });
  }
}