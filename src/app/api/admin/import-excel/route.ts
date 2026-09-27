import { NextRequest, NextResponse } from "next/server";
import readXlsxFile, { readSheetNames } from "read-excel-file/node";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { parseReport, yearFromFilename, REPORT_SHEET } from "@/lib/reportParser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const STAGE_CHUNK = 2000;

/**
 * Step 1 of an import: parse a weekly RawPlayerData report, stage its rows and return a
 * dry-run summary of what applying it would change. Nothing is changed until
 * POST /api/admin/import-excel/commit is called with the returned batch_id.
 *
 * Form fields: file (xlsx), seasonId (optional; defaults to the season matching the year in the filename).
 */
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const db = createSupabaseAdminClient();

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });

    // --- Read the workbook ---
    const buffer = Buffer.from(await file.arrayBuffer());
    let sheetNames: string[];
    try {
      sheetNames = await readSheetNames(buffer);
    } catch {
      return NextResponse.json(
        { error: "Couldn't open this file. If it's password protected, remove the password in Excel and upload it again." },
        { status: 400 }
      );
    }
    const sheet = sheetNames.find((s) => s.replace(/\s/g, "").toLowerCase() === REPORT_SHEET.toLowerCase());
    if (!sheet) {
      return NextResponse.json(
        { error: `No "${REPORT_SHEET}" sheet found (sheets: ${sheetNames.join(", ")}).` },
        { status: 400 }
      );
    }
    const parsed = parseReport(await readXlsxFile(buffer, { sheet }));

    // --- Resolve the season ---
    const { data: seasons, error: sErr } = await db.from("seasons").select("id, name, year").order("year");
    if (sErr) throw sErr;
    const seasonIdParam = Number(form.get("seasonId"));
    const year = yearFromFilename(file.name);
    const season = Number.isFinite(seasonIdParam) && seasonIdParam > 0
      ? seasons?.find((s) => s.id === seasonIdParam)
      : seasons?.find((s) => s.year === year);
    if (!season) {
      return NextResponse.json(
        { error: `Couldn't work out the season for "${file.name}". Pick one, or create the season first.` },
        { status: 400 }
      );
    }

    // --- Clear out previews that were never applied ---
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const { data: stale } = await db
      .from("import_batches")
      .select("id")
      .in("status", ["staged", "previewed"])
      .lt("imported_at", dayAgo);
    if (stale?.length) {
      await db.from("import_staging").delete().in("batch_id", stale.map((b) => b.id));
      await db.from("import_batches").update({ status: "expired" }).in("id", stale.map((b) => b.id));
    }

    // --- Stage ---
    const { data: batch, error: bErr } = await db
      .from("import_batches")
      .insert({
        filename: file.name,
        uploaded_by: gate.user.email ?? gate.user.id,
        season_id: season.id,
        row_count: parsed.rows.length,
        status: "staged",
      })
      .select("id")
      .single();
    if (bErr) throw bErr;

    for (let i = 0; i < parsed.rows.length; i += STAGE_CHUNK) {
      const chunk = parsed.rows.slice(i, i + STAGE_CHUNK).map((r) => ({ ...r, batch_id: batch.id }));
      const { error } = await db.from("import_staging").insert(chunk);
      if (error) throw new Error(`Staging failed: ${error.message}`);
    }

    // --- Preview (dry run: everything is rolled back) ---
    const { data: summary, error: rpcErr } = await db.rpc("import_season_report", {
      p_batch_id: batch.id,
      p_dry_run: true,
    });
    if (rpcErr) throw new Error(`Preview failed: ${rpcErr.message}`);

    return NextResponse.json({
      ok: true,
      batch_id: batch.id,
      file: file.name,
      stats: parsed.stats,
      warnings: parsed.warnings,
      summary,
    });
  } catch (e: any) {
    console.error("IMPORT PREVIEW ERROR:", e);
    return NextResponse.json({ error: e?.message || "Import failed" }, { status: 500 });
  }
}
