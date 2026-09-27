import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/adminAuth";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "site-media";
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

/** Upload an image to the public media bucket. Form fields: file, folder ("news" | "badges" | "logos"). */
export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const form = await req.formData();
  const file = form.get("file");
  const folder = ["badges", "logos"].includes(String(form.get("folder"))) ? String(form.get("folder")) : "news";
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });

  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Use a PNG, JPG, WebP, GIF or SVG image." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Images must be 5 MB or smaller." }, { status: 400 });

  const path = `${folder}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;
  const db = createSupabaseAdminClient();
  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, cacheControl: "31536000" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = db.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
