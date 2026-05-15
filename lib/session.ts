/**
 * HTTP-only cookie session management
 * Uses JWT for session tokens
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "privatetube_session";
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days in seconds

export interface SessionUser {
  email: string;
  suiAddress: string;
  googleSub: string;
  iat?: number;
  exp?: number;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return new TextEncoder().encode(secret);
}

/**
 * Create a signed JWT session token
 */
export async function createSessionToken(user: SessionUser): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({
    email: user.email,
    suiAddress: user.suiAddress,
    googleSub: user.googleSub,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(secret);
}

/**
 * Verify and decode a session token
 */
export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

/**
 * Set session cookie in a NextResponse
 */
export function setSessionCookie(
  response: NextResponse,
  token: string
): NextResponse {
  const isProduction = process.env.NODE_ENV === "production";
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
  return response;
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}

/**
 * Get session user from request cookies
 */
export async function getSessionFromRequest(
  req: NextRequest
): Promise<SessionUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Get session user from server component cookies
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Require session — returns user or throws 401 response
 */
export async function requireSession(
  req: NextRequest
): Promise<SessionUser> {
  const user = await getSessionFromRequest(req);
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}
