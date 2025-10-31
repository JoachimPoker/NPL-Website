// src/app/api/admin/seasons/upsert/route.ts
import { NextResponse } from "next/server"
import { withAdminAuth } from "@/lib/adminAuth"

export const runtime = "nodejs"
export const revalidate = 0

type UpsertBody = {
  id?: number | null
  label: string
  start_date: string
  end_date: string
  method: "ALL" | "BEST_X"
  cap_x?: number | null
  notes?: string | null
  prize_bands?: Array<{ from: number; to?: number; text: string }>
  is_active?: boolean
}

export const POST = withAdminAuth(async (req, { supabase }) => {
  try {
    const body = (await req.json()) as Partial<UpsertBody>

    // --- validate / normalize incoming body ---
    const v = validateAndNormalize(body)
    if (!v.ok) {
      return NextResponse.json({ _error: v.error }, { status: 400 })
    }
    const input = v.value

    const payload: any = {
      label: input.label,
      start_date: input.start_date,
      end_date: input.end_date,
      method: input.method,
      cap_x: input.method === "BEST_X" ? input.cap_x : null,
      notes: input.notes ?? null,
      prize_bands: input.prize_bands ?? [],
      is_active: !!input.is_active,
    }

    let saved: any | null = null

    if (input.id && Number.isFinite(input.id)) {
      // UPDATE
      const { data, error } = await supabase
        .from("seasons")
        .update(payload)
        .eq("id", input.id)
        .select(
          "id,label,start_date,end_date,method,cap_x,is_active,notes,prize_bands,created_at,updated_at"
        )
        .single()

      if (error) return NextResponse.json({ _error: error.message }, { status: 400 })
      saved = data
    } else {
      // INSERT
      const { data, error } = await supabase
        .from("seasons")
        .insert([payload])
        .select(
          "id,label,start_date,end_date,method,cap_x,is_active,notes,prize_bands,created_at,updated_at"
        )
        .single()

      if (error) return NextResponse.json({ _error: error.message }, { status: 400 })
      saved = data
    }

    // Ensure only one active season if requested
    if (input.is_active && saved?.id) {
      const { error: clearErr } = await supabase
        .from("seasons")
        .update({ is_active: false })
        .neq("id", saved.id)
      if (clearErr) {
        return NextResponse.json(
          {
            season: saved,
            warning:
              "Activated this season, but failed to deactivate other seasons: " +
              clearErr.message,
          },
          { status: 200 }
        )
      }
      const { data: refreshed } = await supabase
        .from("seasons")
        .select(
          "id,label,start_date,end_date,method,cap_x,is_active,notes,prize_bands,created_at,updated_at"
        )
        .eq("id", saved.id)
        .single()
      if (refreshed) saved = refreshed
    }

    return NextResponse.json({ season: saved })
  } catch (e: any) {
    return NextResponse.json({ _error: e?.message || "Unexpected error" }, { status: 500 })
  }
})

/* ----------------- validation helpers ----------------- */

function isYMD(s?: string | null) {
  if (!s || typeof s !== "string") return false
  // very basic YYYY-MM-DD check
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function normalizePrizeBands(
  bands?: Array<{ from: any; to?: any; text: any }>
): Array<{ from: number; to: number; text: string }> {
  if (!Array.isArray(bands)) return []
  const out: Array<{ from: number; to: number; text: string }> = []
  for (const b of bands) {
    const from = toInt(b?.from, 1) // always returns a number
    const to = toInt(b?.to ?? from, from) // always returns a number
    const text = String(b?.text ?? "").trim()
    if (from >= 1 && to >= from) {
      out.push({ from, to, text })
    }
  }
  return out
}

/** toInt that never returns null; falls back to provided default (or 0) */
function toInt(v: any, dflt: number = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : dflt
}

function validateAndNormalize(
  body: Partial<UpsertBody>
): { ok: true; value: UpsertBody } | { ok: false; error: string } {
  const label = String(body.label ?? "").trim()
  if (!label) return { ok: false, error: "label is required" }

  const start_date = String(body.start_date ?? "").trim()
  const end_date = String(body.end_date ?? "").trim()
  if (!isYMD(start_date)) return { ok: false, error: "start_date must be YYYY-MM-DD" }
  if (!isYMD(end_date)) return { ok: false, error: "end_date must be YYYY-MM-DD" }
  if (start_date > end_date) return { ok: false, error: "start_date must be <= end_date" }

  const method: "ALL" | "BEST_X" = body.method === "BEST_X" ? "BEST_X" : "ALL"

  let cap_x: number | null = null
  if (method === "BEST_X") {
    const cap = toInt(body.cap_x, 0)
    if (!cap || cap < 1) return { ok: false, error: "cap_x must be a positive integer for BEST_X" }
    cap_x = cap
  }

  const prize_bands = normalizePrizeBands(body.prize_bands)
  const notes = body.notes == null ? null : String(body.notes)
  // Accept either body.is_active or a mis-typed is_it_active without breaking TS
  const is_active = Boolean((body as any).is_it_active ?? body.is_active)

  const idVal = body.id as number | null | undefined
  const id =
    typeof idVal === "number" && Number.isFinite(idVal)
      ? Math.trunc(idVal)
      : idVal == null
      ? null
      : null

  return {
    ok: true,
    value: {
      id,
      label,
      start_date,
      end_date,
      method,
      cap_x,
      notes,
      prize_bands,
      is_active,
    },
  }
}
