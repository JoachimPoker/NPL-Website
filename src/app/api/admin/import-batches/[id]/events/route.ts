import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabaseServer";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const supabase = await createSupabaseRouteClient();
  const batchId = params.id;

  // 1. Find all results linked to this batch
  const { data: resultRows } = await supabase
    .from("results")
    .select("event_id")
    .eq("import_batch_id", batchId);
    
  if (!resultRows || resultRows.length === 0) {
    return NextResponse.json([]);
  }

  // 2. Get unique Event IDs
  const eventIds = Array.from(new Set(resultRows.map((r: any) => r.event_id)));

  // 3. Fetch the actual Event details
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .in("id", eventIds)
    .order("start_date", { ascending: false });

  return NextResponse.json(events || []);
}