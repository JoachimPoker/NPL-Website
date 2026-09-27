import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Create or update a season. Body: { id?, label, start_date, end_date, is_active }
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ _error: gate.error }, { status: gate.status });
  const db = gate.supabase;

  const b = await req.json().catch(() => null);
  const label = String(b?.label ?? "").trim();
  if (!label) return NextResponse.json({ _error: "Label is required." }, { status: 400 });
  if (!b?.start_date || !b?.end_date) return NextResponse.json({ _error: "Start and end dates are required." }, { status: 400 });
  if (new Date(b.start_date) > new Date(b.end_date)) {
    return NextResponse.json({ _error: "Start date cannot be after end date." }, { status: 400 });
  }

  const row = {
    name: label,
    // The season's year is the year it ends in (the 2025 season starts in December 2024).
    year: new Date(b.end_date).getFullYear(),
    start_date: b.start_date,
    end_date: b.end_date,
    is_active: !!b.is_active,
  };

  const id = Number(b.id);
  const isNew = !Number.isFinite(id) || id <= 0;
  const clash = await db.from("seasons").select("id").eq("year", row.year).neq("id", isNew ? -1 : id).maybeSingle();
  if (clash.data) return NextResponse.json({ _error: `There is already a ${row.year} season.` }, { status: 409 });

  if (row.is_active) {
    const { error } = await db.from("seasons").update({ is_active: false }).neq("id", isNew ? -1 : id);
    if (error) return NextResponse.json({ _error: error.message }, { status: 500 });
  }

  if (isNew) {
    const { data, error } = await db.from("seasons").insert(row).select("id").single();
    if (error) return NextResponse.json({ _error: error.message }, { status: 500 });
    // Every season needs a main league; add others on the season's page.
    await db.from("leagues").insert({
      season_id: data.id, slug: "npl", label: "National Poker League", scoring_method: "total",
    });
    return NextResponse.json({ ok: true, id: data.id });
  }

  const { error } = await db.from("seasons").update(row).eq("id", id);
  if (error) return NextResponse.json({ _error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}
