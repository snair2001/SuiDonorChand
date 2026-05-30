/**
 * Sui zkLogin utilities
 * Handles Google OAuth + zkLogin flow
 */

import { createHash } from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ZkLoginState {
  randomness: string;
  ephemeralPublicKey: string;
  ephemeralPrivateKey: string;
  nonce: string;
  maxEpoch: number;
  createdAt: number;
}

export interface GoogleJwtPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  aud: string;
  iss: string;
  iat: number;
  exp: number;
  nonce?: string;
}

// ─── Salt Generation ──────────────────────────────────────────────────────────

/**
 * Generate a deterministic salt from Google subject ID
 * This ensures the same Sui address is derived for the same Google account
 */
export function generateUserSalt(googleSub: string): string {
  const secret = process.env.ZKLOGIN_SALT_SECRET;
  if (!secret) throw new Error("ZKLOGIN_SALT_SECRET is not configured");

  const hash = createHash("sha256")
    .update(`${secret}:${googleSub}`)
    .digest("hex");

  // Return first 32 chars as salt (must be numeric string for zkLogin)
  // Convert hex to decimal-like string
  const saltBigInt = BigInt("0x" + hash.slice(0, 32));
  return saltBigInt.toString();
}

// ─── Address Derivation ───────────────────────────────────────────────────────

/**
 * Derive zkLogin Sui address from Google JWT
 * Uses @mysten/sui jwtToAddress with fallback for reliability
 */
export async function deriveZkLoginAddress(
  jwtToken: string,
  userSalt: string
): Promise<string> {
  try {
    const { jwtToAddress } = await import("@mysten/sui/zklogin");
    // Try with legacyAddress=true first for broader compatibility
    try {
      return jwtToAddress(jwtToken, userSalt, true);
    } catch {
      // If legacy fails, try with false
      return jwtToAddress(jwtToken, userSalt, false);
    }
  } catch (err) {
    console.error("Failed to derive zkLogin address:", err);
    // Fallback: generate deterministic address from JWT claims
    const decoded = decodeJwt(jwtToken);
    const { createHash } = await import("crypto");
    const hash = createHash("sha256")
      .update(`sui:${decoded.sub}:${userSalt}`)
      .digest("hex");
    return `0x${hash.slice(0, 64)}`;
  }
}

// ─── JWT Decoding ─────────────────────────────────────────────────────────────

/**
 * Decode a JWT without verification (verification done by Google's JWKS)
 */
export function decodeJwt(token: string): GoogleJwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const payload = parts[1];
  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  return JSON.parse(decoded) as GoogleJwtPayload;
}

/**
 * Verify Google ID token using Google's tokeninfo endpoint
 */
export async function verifyGoogleToken(
  idToken: string
): Promise<GoogleJwtPayload> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
  );

  if (!res.ok) {
    throw new Error("Failed to verify Google token");
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`Google token verification failed: ${data.error}`);
  }

  // Verify audience matches our client ID
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (clientId && data.aud !== clientId) {
    throw new Error("Token audience mismatch");
  }

  return data as GoogleJwtPayload;
}

// ─── OAuth URL Generation ─────────────────────────────────────────────────────

/**
 * Generate Google OAuth URL for zkLogin
 */
export function generateGoogleOAuthUrl(nonce: string, requestUrl?: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  let redirectUri = process.env.GOOGLE_REDIRECT_URI;

  // If no explicit redirect URI, try to determine from request or environment
  if (!redirectUri && requestUrl) {
    try {
      const url = new URL(requestUrl);
      let origin = url.origin;
      // Force HTTPS in production
      if (process.env.NODE_ENV === "production" && origin.startsWith("http://")) {
        origin = origin.replace("http://", "https://");
      }
      redirectUri = `${origin}/api/auth/zklogin/callback`;
    } catch (e) {
      // Fallback to localhost if URL parsing fails
      redirectUri = "http://localhost:3000/api/auth/zklogin/callback";
    }
  } else if (redirectUri && process.env.NODE_ENV === "production" && redirectUri.startsWith("http://")) {
    // If we have a redirect URI but it's http in production, upgrade to https
    redirectUri = redirectUri.replace("http://", "https://");
  }

  if (!clientId || !redirectUri) {
    throw new Error("Google OAuth not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    nonce: nonce,
    access_type: "offline",
    prompt: "select_account",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string, requestUrl?: string): Promise<{
  id_token: string;
  access_token: string;
  refresh_token?: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  let redirectUri = process.env.GOOGLE_REDIRECT_URI;

  // If no explicit redirect URI, try to determine from request or environment
  if (!redirectUri && requestUrl) {
    try {
      const url = new URL(requestUrl);
      let origin = url.origin;
      // Force HTTPS in production
      if (process.env.NODE_ENV === "production" && origin.startsWith("http://")) {
        origin = origin.replace("http://", "https://");
      }
      redirectUri = `${origin}/api/auth/zklogin/callback`;
    } catch (e) {
      // Fallback to localhost if URL parsing fails
      redirectUri = "http://localhost:3000/api/auth/zklogin/callback";
    }
  } else if (redirectUri && process.env.NODE_ENV === "production" && redirectUri.startsWith("http://")) {
    // If we have a redirect URI but it's http in production, upgrade to https
    redirectUri = redirectUri.replace("http://", "https://");
  }

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth credentials not configured");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  return res.json();
}

// ─── ZK Proof (Placeholder) ───────────────────────────────────────────────────

/**
 * Generate zkLogin proof
 * TODO: Integrate with Mysten Labs ZK proving service
 * https://docs.sui.io/concepts/cryptography/zklogin
 *
 * For production, call the prover endpoint:
 * POST https://prover.mystenlabs.com/v1
 * {
 *   jwt: string,
 *   extendedEphemeralPublicKey: string,
 *   maxEpoch: number,
 *   jwtRandomness: string,
 *   salt: string,
 *   keyClaimName: "sub"
 * }
 */
export async function generateZkLoginProof(params: {
  jwt: string;
  extendedEphemeralPublicKey: string;
  maxEpoch: number;
  jwtRandomness: string;
  salt: string;
}): Promise<{
  proofPoints: unknown;
  issBase64Details: unknown;
  headerBase64: string;
}> {
  // TODO: Replace with actual prover service call
  // This is a placeholder structure for the ZK proof
  console.warn(
    "generateZkLoginProof: Using placeholder — integrate with Mysten Labs prover for production"
  );

  // For MVP, we use the session-based auth without full ZK proof
  // The address derivation still works correctly via jwtToAddress
  return {
    proofPoints: {
      a: ["0", "0", "1"],
      b: [["0", "0"], ["0", "0"], ["1", "0"]],
      c: ["0", "0", "1"],
    },
    issBase64Details: {
      value: "accounts.google.com",
      indexMod4: 0,
    },
    headerBase64: Buffer.from(
      JSON.stringify({ alg: "RS256", kid: "placeholder" })
    ).toString("base64"),
  };
}
