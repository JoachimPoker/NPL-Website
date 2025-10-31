// src/app/api/seasons/list/route.ts
import { NextResponse } from "next/server"
import { createSupabaseRouteClient } from "@/lib/supabaseServer"

export const runtime = "nodejs"
export const revalidate = 0

type SeasonRow = {
  id: number
  label: string
  start_date: string
  end_date: string
  method: "ALL" | "BEST_X"
  cap_x: number | null
  is_active: boolean
  notes: string | null
  prize_bands: Array<{ from: number; to: number; text: string }> | null
  created_at: string
  updated_at: string
}

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseRouteClient()
    const url = new URL(req.url)

    // Optional filters / sorting
    const activeParam = url.searchParams.get("active")
    const activeFilter =
      typeof activeParam === "string"
        ? ["true", "1", "yes"].includes(activeParam.toLowerCase())
        : null

    const orderBy = (url.searchParams.get("orderBy") || "start_date") as
      | "start_date"
      | "end_date"
      | "id"
      | "label"

    const dirParam = (url.searchParams.get("dir") || "desc").toLowerCase()
    const dir: "asc" | "desc" = dirParam === "asc" ? "asc" : "desc"

    // Build query
    let query = supabase
      .from("seasons")
      .select(
        "id,label,start_date,end_date,method,cap_x,is_active,notes,prize_bands,created_at,updated_at"
      )

    if (activeFilter !== null) {
      query = query.eq("is_active", activeFilter)
    }

    // Order by selected column, then id (stable)
    query = query.order(orderBy, { ascending: dir === "asc" }).order("id", { ascending: false })

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ _error: error.message }, { status: 400 })
    }

    const seasons = (data ?? []) as SeasonListItem[]

    return NextResponse.json({ seasons })
  } catch (e: any) {
    return NextResponse.json(
        { _error: e?.message || "Unexpected error" },
        { status: 500 }
    )
  }
}

type SeasonListItem = {
  id: number
  label: string
  start_date: string
  end_date: string
  method: "ALL" | "BEST_X"
  cap_x: number | null
  is_active: boolean
  notes: string | null
  prize_bands: Array<{ from: number; to: number; text: string }> | null
  created_at: string
  updated_at: string
}
