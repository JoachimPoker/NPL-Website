import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const revalidate = 0;

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = body.id ? String(body.id) : null;
    const display_name = String(body.display_name || "").trim();
    const country = (body.country ?? null) ? String(body.country).trim() : null;
    const notes = (body.notes ?? null) ? String(body.notes).trim() : null;
    const is_active = body.is_active === false ? false : true;

    if (!display_name) {
      return NextResponse.json({ _error: "display_name is required" }, { status: 400 });
    }

    const s = supabaseAdmin();

    // Unique slug strategy: base + suffix if needed
    let slug = body.slug ? String(body.slug).trim() : slugify(display_name);
    if (!slug) slug = slugify(display_name);

    if (!id) {
      // New record: ensure unique slug
      let attempt = slug, n = 1;
      for (;;) {
        const { data: clash, error: clashErr } = await s
          .from("players")
          .select("id")
          .eq("slug", attempt)
          .maybeSingle();
        if (clashErr) throw clashErr;
        if (!clash) { slug = attempt; break; }
        n += 1; attempt = `${slug}-${n}`;
      }
    }

    if (id) {
      const { data, error } = await s
        .from("players")
        .update({
          display_name, country, notes, is_active, updated_at: new Date().toISOString()
        })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ player: data });
    } else {
      const { data, error } = await s
        .from("players")
        .insert({ slug, display_name, country, notes, is_active })
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ player: data });
    }
  } catch (e: any) {
    return NextResponse.json({ _error: e?.message || String(e) }, { status: 500 });
  }
}
