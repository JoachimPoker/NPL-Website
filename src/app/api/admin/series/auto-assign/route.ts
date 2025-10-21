// src/app/api/admin/series/auto-assign/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 0;

// keep a single logic path: reuse the "all" endpoint
export async function POST(_req: Request) {
  try {
    const base =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
    const res = await fetch(`${base}/api/admin/series/auto-assign-all`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      return NextResponse.json({ _error: json?._error || res.statusText }, { status: 500 });
    }
    return NextResponse.json(json);
  } catch (e: any) {
    return NextResponse.json({ _error: String(e?.message || e) }, { status: 500 });
  }
}
