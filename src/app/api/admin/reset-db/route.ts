import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const revalidate = 0;

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();

    // 1. Check Admin (Basic check, relies on RLS or Middleware for full security)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Call RPC to truncate
    // FIX: Cast to 'any' to bypass TypeScript error if types aren't regenerated yet
    const { error } = await supabase.rpc('truncate_all_tables' as any);

    if (error) {
      console.error("Reset DB Error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Database reset complete." });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}