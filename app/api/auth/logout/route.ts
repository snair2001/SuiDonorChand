/**
 * POST /api/auth/logout
 * Clears the session cookie
 */

import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

export async function POST() {
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
