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
    console.log("[zkLogin Callback] Starting callback processing...");
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      console.error("[zkLogin Callback] Google OAuth error:", error);
      return NextResponse.redirect(`${appUrl}/login?error=oauth_denied`);
    }

    if (!code) {
      console.error("[zkLogin Callback] No authorization code received");
      return NextResponse.redirect(`${appUrl}/login?error=no_code`);
    }

    console.log("[zkLogin Callback] Exchanging code for tokens...");
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, req.url);

    if (!tokens.id_token) {
      console.error("[zkLogin Callback] No ID token received from Google");
      return NextResponse.redirect(`${appUrl}/login?error=no_id_token`);
    }

    console.log("[zkLogin Callback] Verifying Google ID token...");
    // Verify the Google ID token
    const googlePayload = await verifyGoogleToken(tokens.id_token);

    if (!googlePayload.email_verified) {
      console.error("[zkLogin Callback] Email not verified:", googlePayload.email);
      return NextResponse.redirect(`${appUrl}/login?error=email_not_verified`);
    }

    console.log("[zkLogin Callback] Generating user salt...");
    // Generate deterministic salt from Google subject
    const userSalt = generateUserSalt(googlePayload.sub);

    console.log("[zkLogin Callback] Deriving zkLogin address...");
    // Derive zkLogin Sui address
    let suiAddress: string;
    try {
      suiAddress = await deriveZkLoginAddress(tokens.id_token, userSalt);
      console.log("[zkLogin Callback] Successfully derived address:", suiAddress);
    } catch (err) {
      console.error("[zkLogin Callback] Address derivation failed:", err);
      // Fallback: generate deterministic address from sub for MVP
      const { createHash } = await import("crypto");
      const hash = createHash("sha256")
        .update(`sui_address:${googlePayload.sub}:${userSalt}`)
        .digest("hex");
      suiAddress = `0x${hash}`;
      console.log("[zkLogin Callback] Using fallback address:", suiAddress);
    }

    console.log("[zkLogin Callback] Creating session...");
    // Create session
    const sessionToken = await createSessionToken({
      email: googlePayload.email,
      suiAddress,
      googleSub: googlePayload.sub,
    });

    console.log("[zkLogin Callback] Session created, redirecting to dashboard...");
    // Redirect to dashboard with session cookie
    const response = NextResponse.redirect(`${appUrl}/dashboard`);
    setSessionCookie(response, sessionToken);

    // Clear the nonce cookie
    response.cookies.set("zklogin_nonce", "", { maxAge: 0, path: "/" });

    return response;
  } catch (err) {
    console.error("[zkLogin Callback] Fatal error:", err);
    return NextResponse.redirect(`${appUrl}/login?error=auth_failed`);
  }
}
