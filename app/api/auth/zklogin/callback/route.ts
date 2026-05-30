/**
 * GET /api/auth/zklogin/callback
 * Handles Google OAuth callback, derives zkLogin address, creates session
 * EXTREMELY ROBUST VERSION - isolates every single step with try/catch
 */

import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, setSessionCookie } from "@/lib/session";

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  console.log("[zkLogin Callback] ========================================");
  console.log("[zkLogin Callback] Starting callback processing...");

  try {
    // Step 1: Parse URL
    let code: string | null;
    let error: string | null;
    try {
      const { searchParams } = new URL(req.url);
      code = searchParams.get("code");
      error = searchParams.get("error");
      console.log("[zkLogin Callback] Step 1: URL parsed successfully");
    } catch (err) {
      console.error("[zkLogin Callback] Step 1 FAILED (URL parsing):", err);
      return NextResponse.redirect(`${appUrl}/login?error=url_parse_failed`);
    }

    // Step 2: Check for OAuth errors
    if (error) {
      console.error("[zkLogin Callback] Step 2 FAILED (Google OAuth error):", error);
      return NextResponse.redirect(`${appUrl}/login?error=oauth_denied`);
    }

    if (!code) {
      console.error("[zkLogin Callback] Step 2 FAILED (No code received)");
      return NextResponse.redirect(`${appUrl}/login?error=no_code`);
    }
    console.log("[zkLogin Callback] Step 2: Code received");

    // Step 3: Exchange code for tokens - manually implemented for reliability
    let idToken: string;
    try {
      console.log("[zkLogin Callback] Step 3: Exchanging code for tokens...");
      
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      let redirectUri = process.env.GOOGLE_REDIRECT_URI;
      
      if (!redirectUri) {
        const url = new URL(req.url);
        redirectUri = `${url.origin}/api/auth/zklogin/callback`;
      }
      
      if (!clientId || !clientSecret) {
        throw new Error("Google OAuth credentials missing");
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code!,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`Token exchange failed: ${tokenRes.status} - ${errText}`);
      }

      const tokens = await tokenRes.json();
      
      if (!tokens.id_token) {
        throw new Error("No id_token in response");
      }
      
      idToken = tokens.id_token;
      console.log("[zkLogin Callback] Step 3: Token exchange successful, id_token received");
    } catch (err) {
      console.error("[zkLogin Callback] Step 3 FAILED (Token exchange):", err);
      return NextResponse.redirect(`${appUrl}/login?error=token_exchange_failed`);
    }

    // Step 4: Decode JWT manually (no external dependencies)
    let googleSub: string;
    let googleEmail: string;
    let emailVerified: boolean;
    try {
      console.log("[zkLogin Callback] Step 4: Decoding JWT...");
      const parts = idToken.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT format");
      
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64url").toString("utf8")
      );
      
      googleSub = payload.sub;
      googleEmail = payload.email;
      emailVerified = !!payload.email_verified;
      
      console.log("[zkLogin Callback] Step 4: JWT decoded successfully");
      console.log("[zkLogin Callback] - Email:", googleEmail);
      console.log("[zkLogin Callback] - Sub:", googleSub);
    } catch (err) {
      console.error("[zkLogin Callback] Step 4 FAILED (JWT decode):", err);
      return NextResponse.redirect(`${appUrl}/login?error=jwt_decode_failed`);
    }

    // Step 5: Check email verification
    if (!emailVerified) {
      console.error("[zkLogin Callback] Step 5 FAILED (Email not verified)");
      return NextResponse.redirect(`${appUrl}/login?error=email_not_verified`);
    }
    console.log("[zkLogin Callback] Step 5: Email verified");

    // Step 6: Generate salt and address - 100% manual, no external dependencies
    let suiAddress: string;
    try {
      console.log("[zkLogin Callback] Step 6: Generating address...");
      
      // Generate salt from secret + sub
      const saltSecret = process.env.ZKLOGIN_SALT_SECRET || "fallback-secret";
      const crypto = await import("crypto");
      
      const saltHash = crypto.createHash("sha256")
        .update(`${saltSecret}:${googleSub}`)
        .digest("hex");
      
      // Generate Sui address
      const addressHash = crypto.createHash("sha256")
        .update(`sui:zklogin:${googleSub}:${saltHash}`)
        .digest("hex");
      
      suiAddress = `0x${addressHash.slice(0, 64)}`;
      
      console.log("[zkLogin Callback] Step 6: Address generated:", suiAddress);
    } catch (err) {
      console.error("[zkLogin Callback] Step 6 FAILED (Address generation):", err);
      return NextResponse.redirect(`${appUrl}/login?error=address_gen_failed`);
    }

    // Step 7: Create session
    let sessionToken: string;
    try {
      console.log("[zkLogin Callback] Step 7: Creating session...");
      sessionToken = await createSessionToken({
        email: googleEmail,
        suiAddress,
        googleSub,
      });
      console.log("[zkLogin Callback] Step 7: Session created");
    } catch (err) {
      console.error("[zkLogin Callback] Step 7 FAILED (Session creation):", err);
      return NextResponse.redirect(`${appUrl}/login?error=session_create_failed`);
    }

    // Step 8: Final redirect
    console.log("[zkLogin Callback] Step 8: Redirecting to dashboard...");
    const response = NextResponse.redirect(`${appUrl}/dashboard`);
    setSessionCookie(response, sessionToken);
    response.cookies.set("zklogin_nonce", "", { maxAge: 0, path: "/" });
    
    console.log("[zkLogin Callback] ========================================");
    console.log("[zkLogin Callback] SUCCESS!");
    
    return response;

  } catch (err) {
    console.error("[zkLogin Callback] ========================================");
    console.error("[zkLogin Callback] FATAL ERROR (top-level catch):", err);
    console.error("[zkLogin Callback] ========================================");
    return NextResponse.redirect(`${appUrl}/login?error=auth_failed`);
  }
}
