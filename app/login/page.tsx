"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginButton } from "@/components/LoginButton";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Suspense } from "react";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_config_error: "Google OAuth is not configured. Please check environment variables.",
  oauth_denied: "Google login was cancelled.",
  no_code: "No authorization code received from Google.",
  no_id_token: "Failed to get ID token from Google.",
  email_not_verified: "Your Google email is not verified.",
  auth_failed: "Authentication failed. Please try again.",
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);
  const error = searchParams.get("error");

  useEffect(() => {
    // Check if already logged in
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          router.replace("/dashboard");
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-2xl mx-auto">
            PT
          </div>
          <h1 className="text-3xl font-bold text-white">PrivateTube</h1>
          <p className="text-gray-400">
            Sign in with Google to access encrypted videos
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
            {ERROR_MESSAGES[error] || "An error occurred. Please try again."}
          </div>
        )}

        {/* Login card */}
        <div className="glass-card rounded-2xl p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-white">
              Login with zkLogin
            </h2>
            <p className="text-sm text-gray-400">
              No wallet or seed phrase needed. Your Google account generates a
              Sui wallet address automatically.
            </p>
          </div>

          <LoginButton className="w-full" label="Continue with Google" />

          {/* zkLogin explanation */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <p className="text-xs font-medium text-gray-400">
              How Sui zkLogin works:
            </p>
            <div className="space-y-2">
              {[
                "Sign in with your Google account",
                "A unique Sui wallet address is derived from your Google ID",
                "No seed phrases — your Google account IS your wallet",
                "Zero-knowledge proof ensures privacy",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-gray-500">
                  <span className="text-purple-400 mt-0.5">→</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Security note */}
        <div className="text-center text-xs text-gray-600">
          🔐 Your session is stored in an HTTP-only cookie.
          <br />
          We never store your Google password.
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>}>
      <LoginContent />
    </Suspense>
  );
}
