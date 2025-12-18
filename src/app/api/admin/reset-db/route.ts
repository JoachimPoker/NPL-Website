import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { options } = await req.json();
    const supabase = createSupabaseAdminClient();

    // 1. Results (Always first due to Foreign Key constraints)
    if (options.results) {
      await supabase.from("results").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("leaderboard_positions").delete().neq("id", 0);
      await supabase.from("import_batches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    // 2. Events
    if (options.events) {
      await supabase.from("events").delete().neq("id", "placeholder");
    }

    // 3. Players
    if (options.players) {
      await supabase.from("player_aliases").delete().neq("id", 0);
      await supabase.from("players").delete().neq("id", "placeholder");
    }

    // 4. Seasons
    if (options.seasons) {
      await supabase.from("seasons").delete().neq("id", 0);
    }

    // 5. Festivals/Series
    if (options.festivals) {
      await supabase.from("festivals").delete().neq("id", "placeholder");
      await supabase.from("series").delete().neq("id", "placeholder");
    }

    return NextResponse.json({ ok: true, message: "Selected data has been cleared." });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}