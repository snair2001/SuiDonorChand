/**
 * POST /api/auth/zklogin/start
 * Initiates the zkLogin flow by generating nonce and redirecting to Google OAuth
 */

import { NextRequest, NextResponse } from "next/server";
import { generateGoogleOAuthUrl } from "@/lib/zklogin";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  try {
    // Generate a random nonce for this OAuth session
    const nonce = randomBytes(16).toString("hex");

    // Store nonce in a short-lived cookie for verification
    const oauthUrl = generateGoogleOAuthUrl(nonce);

    const response = NextResponse.redirect(oauthUrl);

    // Store nonce in cookie for callback verification
    response.cookies.set("zklogin_nonce", nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("zkLogin start error:", err);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${appUrl}/login?error=oauth_config_error`
    );
  }
}
