"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginButton } from "@/components/LoginButton";
import { LoadingPage } from "@/components/LoadingSpinner";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_config_error: "Google OAuth is not configured. Check environment variables.",
  oauth_denied: "Google login was cancelled.",
  no_code: "No authorization code received from Google.",
  url_parse_failed: "Failed to parse the callback URL.",
  token_exchange_failed: "Failed to exchange code for Google tokens. Check Google OAuth credentials or redirect URI.",
  jwt_decode_failed: "Failed to decode Google's JWT token.",
  email_not_verified: "Your Google email is not verified.",
  address_gen_failed: "Failed to generate Sui address.",
  session_create_failed: "Failed to create user session.",
  auth_failed: "Authentication failed. Please try again.",
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);
  const error = searchParams.get("error");

  useEffect(() => {
    fetch("/api/auth/session").then(r => r.json()).then(data => {
      if (data.user) router.replace("/dashboard");
      else setChecking(false);
    }).catch(() => setChecking(false));
  }, [router]);

  if (checking) return <LoadingPage message="Checking session..." />;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem", position: "relative" }}>
      {/* Glow */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%,-50%)", width: "600px", height: "400px", background: "radial-gradient(ellipse, rgba(120,40,200,0.18) 0%, transparent 65%)", borderRadius: "50%" }} />
      </div>

      <div style={{ position: "relative", width: "100%", maxWidth: "440px" }} className="stack-xl">
        {/* Logo */}
        <div style={{ textAlign: "center" }} className="stack-sm">
          <div style={{ width: "64px", height: "64px", borderRadius: "18px", background: "linear-gradient(135deg, #7c3aed, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "1.25rem", margin: "0 auto", boxShadow: "0 0 32px rgba(124,58,237,0.4)" }}>
            PT
          </div>
          <h1 style={{ fontSize: "1.875rem", fontWeight: 800, color: "#f8fafc" }}>PrivateTube</h1>
          <p style={{ color: "#64748b" }}>Sign in with Google to access encrypted videos</p>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-error">
            <span>⚠️</span>
            {ERROR_MESSAGES[error] || "An error occurred. Please try again."}
          </div>
        )}

        {/* Card */}
        <div className="card" style={{ padding: "2rem" }}>
          <div className="stack-xs">
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#f8fafc" }}>Login with zkLogin</h2>
            <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
              No wallet or seed phrase needed. Your Google account generates a Sui wallet address automatically.
            </p>
          </div>

          <LoginButton label="Continue with Google" />

          <div style={{ paddingTop: "1.25rem", borderTop: "1px solid rgba(255,255,255,0.07)" }} className="stack-sm">
            <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#64748b" }}>How Sui zkLogin works:</p>
            <div className="stack-xs">
              {[
                "Sign in with your Google account",
                "A unique Sui wallet address is derived from your Google ID",
                "No seed phrases — your Google account IS your wallet",
                "Zero-knowledge proof ensures privacy",
              ].map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
                  <span style={{ color: "#7c3aed", fontWeight: 700, flexShrink: 0, marginTop: "1px" }}>→</span>
                  <span style={{ fontSize: "0.8125rem", color: "#64748b" }}>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: "0.8125rem", color: "#334155" }}>
          🔐 Session stored in HTTP-only cookie · We never store your Google password
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingPage message="Loading..." />}>
      <LoginContent />
    </Suspense>
  );
}
