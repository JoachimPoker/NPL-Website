import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ _error: gate.error }, { status: gate.status });

  const { data, error } = await gate.supabase
    .from("seasons")
    .select("id, label:name, year, start_date, end_date, is_active, created_at")
    .order("year", { ascending: false });
  if (error) return NextResponse.json({ _error: error.message }, { status: 500 });
  return NextResponse.json({ seasons: data ?? [] });
}
