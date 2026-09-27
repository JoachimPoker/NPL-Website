import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ _error: gate.error }, { status: gate.status });

  const id = Number((await req.json().catch(() => null))?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ _error: "Missing id" }, { status: 400 });

  const off = await gate.supabase.from("seasons").update({ is_active: false }).neq("id", id);
  if (off.error) return NextResponse.json({ _error: off.error.message }, { status: 500 });
  const on = await gate.supabase.from("seasons").update({ is_active: true }).eq("id", id);
  if (on.error) return NextResponse.json({ _error: on.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
