/**
 * GET /api/auth/zklogin/callback
 * Handles Google OAuth callback, derives zkLogin address, creates session
 */

import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  verifyGoogleToken,
  generateUserSalt,
  deriveZkLoginAddress,
} from "@/lib/zklogin";
import { createSessionToken, setSessionCookie } from "@/lib/session";

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      console.error("Google OAuth error:", error);
      return NextResponse.redirect(`${appUrl}/login?error=oauth_denied`);
    }

    if (!code) {
      return NextResponse.redirect(`${appUrl}/login?error=no_code`);
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, req.url);

    if (!tokens.id_token) {
      return NextResponse.redirect(`${appUrl}/login?error=no_id_token`);
    }

    // Verify the Google ID token
    const googlePayload = await verifyGoogleToken(tokens.id_token);

    if (!googlePayload.email_verified) {
      return NextResponse.redirect(`${appUrl}/login?error=email_not_verified`);
    }

    // Generate deterministic salt from Google subject
    const userSalt = generateUserSalt(googlePayload.sub);

    // Derive zkLogin Sui address
    let suiAddress: string;
    try {
      suiAddress = await deriveZkLoginAddress(tokens.id_token, userSalt);
    } catch (err) {
      console.error("Address derivation failed:", err);
      // Fallback: generate deterministic address from sub for MVP
      const { createHash } = await import("crypto");
      const hash = createHash("sha256")
        .update(`sui_address:${googlePayload.sub}:${userSalt}`)
        .digest("hex");
      suiAddress = `0x${hash}`;
    }

    // Create session
    const sessionToken = await createSessionToken({
      email: googlePayload.email,
      suiAddress,
      googleSub: googlePayload.sub,
    });

    // Redirect to dashboard with session cookie
    const response = NextResponse.redirect(`${appUrl}/dashboard`);
    setSessionCookie(response, sessionToken);

    // Clear the nonce cookie
    response.cookies.set("zklogin_nonce", "", { maxAge: 0, path: "/" });

    return response;
  } catch (err) {
    console.error("zkLogin callback error:", err);
    return NextResponse.redirect(`${appUrl}/login?error=auth_failed`);
  }
}
