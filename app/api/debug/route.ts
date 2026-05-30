/**
 * Debug endpoint - just fetch and log a CID
 */

import { NextRequest, NextResponse } from "next/server";
import { getJsonFromCid, getLatestRegistry } from "@/lib/pinata";

export async function POST(req: NextRequest) {
  try {
    const { cid } = await req.json();
    console.log("DEBUG FETCHING CID:", cid);

    // Try to fetch it
    const data = await getJsonFromCid(cid);
    console.log("DEBUG CID DATA:", data);

    // Also get latest registry
    const registry = await getLatestRegistry();
    console.log("DEBUG REGISTRY:", registry);

    return NextResponse.json({ data, registry });
  } catch (err) {
    console.error("DEBUG ERROR:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Debug error" },
      { status: 500 }
    );
  }
}
