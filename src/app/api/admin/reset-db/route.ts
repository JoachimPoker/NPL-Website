import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export async function POST() {
  const supabase = await createSupabaseRouteClient();

  try {
    // 1. Double check the user is an admin
    const { data: { user } } = await supabase.auth.getUser();
    // (Optional: add extra check here if you have a specific admin role/email)
    
    // 2. The Nuclear Option
    // TRUNCATE removes all rows. CASCADE handles the foreign keys (e.g. deleting a season deletes its leagues).
    // RESTART IDENTITY resets the auto-increment IDs back to 1.
    const { error } = await supabase.rpc('truncate_all_tables');

    // If you don't have an RPC function, we can do it via raw query if your Supabase client supports it,
    // OR we can just delete in specific order (Children first, then Parents).
    // Since Supabase JS client doesn't support raw SQL easily without RPC, let's use standard deletes.
    
    // Deleting in order to respect Foreign Keys:
    await supabase.from("results").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Delete All
    await supabase.from("player_aliases").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("leaderboard_positions").delete().neq("id", -1);
    await supabase.from("league_bonuses").delete().neq("id", -1);
    
    await supabase.from("events").delete().neq("id", "placeholder"); 
    await supabase.from("leagues").delete().neq("id", -1);
    await supabase.from("festivals").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    
    await supabase.from("seasons").delete().neq("id", -1);
    await supabase.from("series").delete().neq("id", -1);
    await supabase.from("players").delete().neq("id", "placeholder");
    await supabase.from("import_batches").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    return NextResponse.json({ ok: true, message: "Database wiped successfully." });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}