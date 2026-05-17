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
 * Middleware helper: require admin session
 * Admin is determined by ADMIN_EMAIL env var
 */
export async function withAdmin(
  req: NextRequest,
  handler: (user: SessionUser) => Promise<NextResponse>
): Promise<NextResponse> {
  const user = await getSessionFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail || user.email.toLowerCase() !== adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

/**
 * Check if the current session user is admin
 */
export async function isAdmin(req: NextRequest): Promise<boolean> {
  const user = await getSessionFromRequest(req);
  if (!user) return false;
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  return !!adminEmail && user.email.toLowerCase() === adminEmail;
}
