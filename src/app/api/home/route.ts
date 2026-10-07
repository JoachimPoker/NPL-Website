import { NextResponse } from "next/server";
import { getHomeData } from "@/lib/home";

export const runtime = "nodejs";
export const revalidate = 0;

// The home page reads getHomeData() directly; this stays for anything that calls the API.
export async function GET() {
  const data = await getHomeData();
  return NextResponse.json(data, { status: data.ok ? 200 : 500 });
}
