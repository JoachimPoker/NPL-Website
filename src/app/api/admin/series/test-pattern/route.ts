import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

/** Preview which event names a series pattern matches. GET ?pattern=... */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const pattern = (new URL(req.url).searchParams.get("pattern") || "").trim();
  if (!pattern) return NextResponse.json({ count: 0, examples: [] });

  const { data: valid } = await gate.supabase.rpc("is_valid_regex", { p: pattern });
  if (!valid) return NextResponse.json({ error: "That isn't a valid pattern." }, { status: 400 });

  const { data, count, error } = await gate.supabase
    .from("events")
    .select("id, tournament_name, casino, start_date", { count: "exact" })
    .filter("tournament_name", "imatch", pattern)
    .eq("is_deleted", false)
    .order("start_date", { ascending: false })
    .limit(12);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ count: count ?? 0, examples: data ?? [] });
}
