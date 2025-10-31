// src/app/api/admin/seasons/list/route.ts
import { NextResponse } from "next/server"
import { withAdminAuth } from "@/lib/adminAuth"

export const runtime = "nodejs"
export const revalidate = 0

export const GET = withAdminAuth(async (_req, { supabase }) => {
  const { data, error } = await supabase
    .from("seasons")
    .select(
      "id,label,start_date,end_date,method,cap_x,is_active,notes,prize_bands,created_at,updated_at"
    )
    .order("start_date", { ascending: false })
    .order("id", { ascending: false })

  if (error) {
    return NextResponse.json({ _error: error.message }, { status: 400 })
  }
  return NextResponse.json({ seasons: data ?? [] })
})
