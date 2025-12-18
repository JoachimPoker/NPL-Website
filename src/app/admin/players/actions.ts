'use server'

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Database } from "@/types/supabase";

// Helper type for the update object
type PlayerUpdate = Database['public']['Tables']['players']['Update'];

export async function updatePlayerAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  // 1. Check Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  // 2. Extract Data
  const id = formData.get("id")?.toString();
  const forename = formData.get("forename")?.toString().trim();
  const surname = formData.get("surname")?.toString().trim();
  const bio = formData.get("bio")?.toString().trim();
  
  // Note: Add 'email' here if you have added it to your DB schema
  // const email = formData.get("email")?.toString().trim();

  if (!id) throw new Error("Player ID is missing");

  // 3. Prepare Update Object
  const updates: PlayerUpdate = {
    forename,
    surname,
    bio: bio || null,
    updated_at: new Date().toISOString(),
  };

  // 4. Perform Update
  const { error } = await supabase
    .from("players")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("Update Player Error:", error);
    // In a real app, you might return state to show a toast message
    throw new Error(error.message);
  }

  // 5. Revalidate Cache & Redirect
  revalidatePath("/admin/players");
  revalidatePath(`/admin/players/${id}`);
  revalidatePath(`/players/${id}`);
  
  redirect("/admin/players");
}

export async function deletePlayerAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  
  // 1. Check Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const id = formData.get("id")?.toString();
  if (!id) throw new Error("Missing Player ID");

  // 2. Delete
  const { error } = await supabase
    .from("players")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Delete Player Error:", error);
    throw new Error(error.message);
  }

  revalidatePath("/admin/players");
  redirect("/admin/players");
}