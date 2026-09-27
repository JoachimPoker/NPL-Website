import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Step 2 of an import: apply (or cancel) a previewed batch.
 * Body: { batch_id: string, action?: "apply" | "cancel" }
 * Applying runs in a single transaction: either the whole report is imported or nothing is.
 */
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = (await req.json().catch(() => null)) as { batch_id?: string; action?: string } | null;
  const batchId = body?.batch_id;
  if (!batchId) return NextResponse.json({ error: "batch_id required" }, { status: 400 });

  const db = createSupabaseAdminClient();

  const { data: batch, error: bErr } = await db
    .from("import_batches")
    .select("id, status")
    .eq("id", batchId)
    .maybeSingle();
  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });
  if (!batch) return NextResponse.json({ error: "Import not found" }, { status: 404 });
  if (!["staged", "previewed"].includes(batch.status ?? "")) {
    return NextResponse.json({ error: `This import is already ${batch.status}.` }, { status: 409 });
  }

  if (body?.action === "cancel") {
    await db.from("import_staging").delete().eq("batch_id", batchId);
    await db.from("import_batches").update({ status: "cancelled" }).eq("id", batchId);
    return NextResponse.json({ ok: true, cancelled: true });
  }

  const { data: summary, error } = await db.rpc("import_season_report", {
    p_batch_id: batchId,
    p_dry_run: false,
  });
  if (error) {
    console.error("IMPORT APPLY ERROR:", error);
    return NextResponse.json({ error: `Import failed, nothing was changed: ${error.message}` }, { status: 500 });
  }

  // Put new events into series/festivals. A failure here doesn't undo the import; it can be
  // re-run from Admin -> Series.
  const seasonId = (summary as any)?.season?.id ?? null;
  const { data: series, error: aaErr } = await db.rpc("auto_assign_series", { p_season_id: seasonId });
  if (aaErr) console.error("AUTO-ASSIGN AFTER IMPORT FAILED:", aaErr);

  // Award badges earned by the new results (and remove any a correction took away).
  const { data: badges, error: badgeErr } = await db.rpc("award_badges");
  if (badgeErr) console.error("BADGES AFTER IMPORT FAILED:", badgeErr);

  revalidatePath("/", "layout");
  return NextResponse.json({
    ok: true,
    summary,
    series: aaErr ? { error: aaErr.message } : series,
    badges: badgeErr ? { error: badgeErr.message } : badges,
  });
}
