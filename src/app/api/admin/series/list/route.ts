import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseRouteClient();
  const { data, error } = await supabase
    .from("series")
    .select("id,label,name,title,is_active,active,enabled,description")
    .order("label", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []).map((s: any) => ({
    id: String(s.id),
    label: String(s.label ?? s.name ?? s.title ?? "Series"),
    is_active: Boolean(s.is_active ?? s.active ?? s.enabled ?? true),
    description: typeof s.description === "string" ? s.description : null,
  }));

  return NextResponse.json({ ok: true, rows });
}
