// src/app/api/admin/series/upsert/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = {
  id?: number | null;
  name: string;
  slug?: string;
  keywords?: string[];
  is_active?: boolean;
  notes?: string;
};

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as Body;
    const s = supabaseAdmin();

    const payload: any = {
      name: (b.name || "").trim(),
      slug: ((b.slug || "").trim() || toSlug(b.name || "")).slice(0, 80),
      keywords: Array.isArray(b.keywords)
        ? b.keywords.map(k => String(k).toLowerCase().trim()).filter(Boolean)
        : [],
      is_active: b.is_active ?? true,
      notes: b.notes ?? null,
      updated_at: new Date().toISOString(),
    };

    if (!payload.name) {
      return NextResponse.json({ _error: "Name is required" }, { status: 400 });
    }

    let row: any;
    if (b.id) {
      const { data, error } = await s
        .from("series")
        .update(payload)
        .eq("id", b.id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      row = data;
    } else {
      payload.created_at = new Date().toISOString();
      const { data, error } = await s
        .from("series")
        .insert(payload)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      row = data;
    }

    return NextResponse.json({ series: row });
  } catch (e: any) {
    return NextResponse.json({ _error: String(e?.message || e) }, { status: 500 });
  }
}
