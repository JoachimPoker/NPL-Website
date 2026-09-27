import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Only empty seasons can be deleted; a season with imported events keeps its history.
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ _error: gate.error }, { status: gate.status });
  const db = gate.supabase;

  const id = Number((await req.json().catch(() => null))?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ _error: "Missing id" }, { status: 400 });

  const { count } = await db.from("events").select("id", { count: "exact", head: true }).eq("season_id", id);
  if (count) {
    return NextResponse.json(
      { _error: `This season has ${count} events and can't be deleted.` },
      { status: 409 }
    );
  }

  const { error } = await db.from("seasons").delete().eq("id", id);
  if (error) return NextResponse.json({ _error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
