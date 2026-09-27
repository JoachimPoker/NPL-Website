'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";

function text(v: FormDataEntryValue | null) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

async function db() {
  const gate = await requireAdmin();
  if (!gate.ok) throw new Error(gate.error);
  return gate.supabase;
}

function refresh() {
  revalidatePath("/admin/schedule");
  revalidatePath("/", "layout");
}

export async function saveUpcomingAction(formData: FormData) {
  const supabase = await db();
  const id = Number(formData.get("id"));
  const title = text(formData.get("title"));
  const start = text(formData.get("start_date"));
  const end = text(formData.get("end_date"));
  const url = text(formData.get("url"));
  if (!title || !start) throw new Error("A title and start date are required.");
  if (end && end < start) throw new Error("The end date can't be before the start date.");
  if (url && !/^https?:\/\//i.test(url)) throw new Error("The link must start with https://");

  const row = {
    title,
    series_id: text(formData.get("series_id")) ? Number(formData.get("series_id")) : null,
    casino: text(formData.get("casino")),
    city: text(formData.get("city")),
    start_date: start,
    end_date: end,
    description: text(formData.get("description")),
    url,
    is_published: formData.get("is_published") === "on",
    updated_at: new Date().toISOString(),
  };

  const { error } = Number.isFinite(id) && id > 0
    ? await supabase.from("upcoming_events").update(row).eq("id", id)
    : await supabase.from("upcoming_events").insert(row);
  if (error) throw new Error(error.message);

  refresh();
  redirect("/admin/schedule");
}

export async function deleteUpcomingAction(formData: FormData) {
  const supabase = await db();
  const { error } = await supabase.from("upcoming_events").delete().eq("id", Number(formData.get("id")));
  if (error) throw new Error(error.message);
  refresh();
  redirect("/admin/schedule");
}
