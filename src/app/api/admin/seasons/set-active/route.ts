// src/app/api/admin/seasons/set-active/route.ts
import { NextResponse } from "next/server"
import { withAdminAuth } from "@/lib/adminAuth"

export const runtime = "nodejs"
export const revalidate = 0

type SetActiveBody = { id?: number | null }

export const POST = withAdminAuth(async (req, { supabase }) => {
  try {
    const body = (await req.json()) as SetActiveBody
    const id = typeof body.id === "number" && Number.isFinite(body.id) ? Math.trunc(body.id) : null
    if (id == null) {
      return NextResponse.json({ _error: "id is required and must be a number" }, { status: 400 })
    }

    // Ensure target season exists
    const { data: existing, error: getErr } = await supabase
      .from("seasons")
      .select("id")
      .eq("id", id)
      .maybeSingle()
    if (getErr) return NextResponse.json({ _error: getErr.message }, { status: 400 })
    if (!existing) return NextResponse.json({ _error: "Season not found" }, { status: 404 })

    // First, activate the chosen season
    const { data: activated, error: actErr } = await supabase
      .from("seasons")
      .update({ is_active: true })
      .eq("id", id)
      .select(
        "id,label,start_date,end_date,method,cap_x,is_active,notes,prize_bands,created_at,updated_at"
      )
      .single()

    if (actErr) {
      return NextResponse.json({ _error: `Failed to activate season: ${actErr.message}` }, { status: 400 })
    }

    // Then, deactivate all others
    const { error: clearErr } = await supabase.from("seasons").update({ is_active: false }).neq("id", id)
    if (clearErr) {
      // Not fatal, but report it
      return NextResponse.json(
        {
          season: activated,
          warning: `Activated target season, but failed to deactivate others: ${clearErr.message}`,
        },
        { status: 200 }
      )
    }

    // Refresh final active row
    const { data: refreshed, error: refErr } = await supabase
      .from("seasons")
      .select(
        "id,label,start_date,end_date,method,cap_x,is_active,notes,prize_bands,created_at,updated_at"
      )
      .eq("id", id)
      .single()

    if (refErr || !refreshed) {
      return NextResponse.json(
        { season: activated, warning: "Activated, but failed to fetch refreshed row." },
        { status: 200 }
      )
    }

    return NextResponse.json({ season: refreshed })
  } catch (e: any) {
    return NextResponse.json({ _error: e?.message || "Unexpected error" }, { status: 500 })
  }
})
