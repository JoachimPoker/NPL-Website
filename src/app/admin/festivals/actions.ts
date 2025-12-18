'use server'

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Database } from "@/types/supabase";

type FestivalUpdate = Database['public']['Tables']['festivals']['Update'];
type FestivalInsert = Database['public']['Tables']['festivals']['Insert'];

// --- UPDATE FESTIVAL ---
export async function updateFestivalAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  // 1. Check Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // 2. Extract Data
  const id = formData.get("id")?.toString();
  const label = formData.get("label")?.toString().trim();
  const city = formData.get("city")?.toString().trim();
  const start_date = formData.get("start_date")?.toString();
  const end_date = formData.get("end_date")?.toString();
  
  if (!id || !label || !start_date || !end_date) {
    throw new Error("Missing required fields (Label, Start Date, End Date)");
  }

  // 3. Prepare Update
  const updates: FestivalUpdate = {
    label,
    city: city || null,
    start_date,
    end_date,
    updated_at: new Date().toISOString(),
  };

  // 4. Update DB
  const { error } = await supabase
    .from("festivals")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error(error.message);

  // 5. Revalidate
  revalidatePath("/admin/festivals");
  revalidatePath(`/admin/festivals/${id}`);
  
  redirect("/admin/festivals");
}

// --- DELETE FESTIVAL ---
export async function deleteFestivalAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Missing ID");

  const { error } = await supabase.from("festivals").delete().eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/festivals");
  redirect("/admin/festivals");
}

// --- CREATE FESTIVAL ---
export async function createFestivalAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const label = formData.get("label")?.toString().trim();
  const start_date = formData.get("start_date")?.toString();
  const end_date = formData.get("end_date")?.toString();
  const city = formData.get("city")?.toString().trim();

  // Simple validation
  if (!label || !start_date || !end_date) {
    // We can handle errors more gracefully in the UI, but for now throw
    throw new Error("Label, Start Date, and End Date are required.");
  }

  const newFestival: FestivalInsert = {
    label,
    start_date,
    end_date,
    city: city || null,
    keywords: [] // Default empty JSON array
  };

  const { error } = await supabase.from("festivals").insert(newFestival);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/festivals");
  redirect("/admin/festivals");
}