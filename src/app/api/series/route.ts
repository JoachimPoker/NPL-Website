import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseRouteClient();
  const { data, error } = await supabase
    .from("series")
    .select("id,name,is_active,description")
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []).map((s) => ({
    id: String(s.id),
    label: String((s as any).name ?? "Series"),
    is_active: Boolean((s as any).is_active ?? true),
    description: typeof (s as any).description === "string" ? (s as any).description : null,
  }));

  return NextResponse.json(rows);
}
