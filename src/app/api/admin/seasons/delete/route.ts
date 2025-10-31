// src/app/api/admin/seasons/delete/route.ts
import { NextResponse } from "next/server"
import { withAdminAuth } from "@/lib/adminAuth"

export const runtime = "nodejs"
export const revalidate = 0

type DeleteBody = { id?: number | null }

export const POST = withAdminAuth(async (req, { supabase }) => {
  try {
    const body = (await req.json()) as DeleteBody
    const id = typeof body.id === "number" && Number.isFinite(body.id) ? Math.trunc(body.id) : null
    if (id == null) {
      return NextResponse.json({ _error: "id is required and must be a number" }, { status: 400 })
    }

    // Ensure season exists
    const { data: season, error: getErr } = await supabase
      .from("seasons")
      .select("id,label")
      .eq("id", id)
      .maybeSingle()
    if (getErr) return NextResponse.json({ _error: getErr.message }, { status: 400 })
    if (!season) return NextResponse.json({ _error: "Season not found" }, { status: 404 })

    // Detach any festivals pointing to this season to avoid FK issues
    const { data: detached, error: detachErr } = await supabase
      .from("festivals")
      .update({ season_id: null })
      .eq("season_id", id)
      .select("id")

    if (detachErr) {
      return NextResponse.json({ _error: `Failed to detach festivals: ${detachErr.message}` }, { status: 400 })
    }

    const detachedCount = Array.isArray(detached) ? detached.length : 0

    // Delete the season
    const { error: delErr } = await supabase.from("seasons").delete().eq("id", id)
    if (delErr) {
      return NextResponse.json({ _error: delErr.message }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      deleted: id,
      detachedFestivals: detachedCount,
      message: `Season "${season.label}" deleted. Detached ${detachedCount} festival(s).`,
    })
  } catch (e: any) {
    return NextResponse.json({ _error: e?.message || "Unexpected error" }, { status: 500 })
  }
})
