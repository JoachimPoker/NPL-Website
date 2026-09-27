import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { takeLeaderboardSnapshot } from "@/lib/leaderboardUtils";

export const dynamic = "force-dynamic";

export async function POST() {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const { snapshotDate, positions } = await takeLeaderboardSnapshot(createSupabaseAdminClient());
    return NextResponse.json({ ok: true, message: `Snapshot taken for ${snapshotDate} (${positions} positions).` });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
