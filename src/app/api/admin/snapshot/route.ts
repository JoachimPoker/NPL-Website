import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";
import { takeLeaderboardSnapshot } from "@/lib/leaderboardUtils";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createSupabaseRouteClient();
  
  try {
    // Check Admin (Optional but recommended)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Run the helper function
    await takeLeaderboardSnapshot(supabase);

    return NextResponse.json({ ok: true, message: "Snapshot taken successfully." });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}