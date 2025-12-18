'use server'

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { revalidatePath } from "next/cache";
import { Database } from "@/types/supabase";

type EventUpdate = Database['public']['Tables']['events']['Update'];

export async function bulkUpdateEventsAction(eventIds: number[], updates: EventUpdate) {
  const supabase = await createSupabaseServerClient();

  // 1. Auth Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  if (!eventIds.length) return { error: "No events selected" };

  // 2. Perform Bulk Update
  // Since we are applying the SAME update to ALL selected IDs, we can do this in ONE query!
 const { error } = await supabase
    .from("events")
    .update(updates)
    .in("id", eventIds.map(String)); // <--- Added .map(String)

  if (error) {
    console.error("Bulk Update Error:", error);
    throw new Error(error.message);
  }

  // 3. Revalidate
  revalidatePath("/admin/events");
}