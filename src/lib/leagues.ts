import { cache } from "react";
import { createSupabasePublicClient } from "@/lib/supabasePublic";

/** League logos by slug (npl, hrl, lrl). Empty until logos are uploaded in Admin → Leagues. */
export const getLeagueLogos = cache(async () => {
  const supabase = createSupabasePublicClient();
  const { data } = await supabase.from("league_brands").select("slug, logo_url");
  return new Map((data || []).filter((b) => b.logo_url).map((b) => [b.slug, b.logo_url as string]));
});
