/**
 * Auth utilities — server-side only
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, SessionUser } from "./session";

/**
 * Middleware helper: require authenticated session
 * Returns user or sends 401 response
 */
export async function withAuth(
  req: NextRequest,
  handler: (user: SessionUser) => Promise<NextResponse>
): Promise<NextResponse> {
  const user = await getSessionFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return handler(user);
}

/**
 * Check if user is authenticated (non-throwing)
 */
export async function isAuthenticated(req: NextRequest): Promise<boolean> {
  const user = await getSessionFromRequest(req);
  return user !== null;
}
