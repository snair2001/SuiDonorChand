"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreateVideoForm } from "@/components/CreateVideoForm";
import { LoadingPage } from "@/components/LoadingSpinner";

export default function CreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) {
          router.replace("/login");
        } else {
          setAuthed(true);
          setLoading(false);
        }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  if (loading) return <LoadingPage message="Checking authentication..." />;
  if (!authed) return null;

  return (
    <div className="min-h-screen px-4 py-8">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-purple-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">
            Create Encrypted Video
          </h1>
          <p className="text-gray-400">
            Your YouTube URL will be encrypted with AES-256-GCM and stored on
            Pinata IPFS
          </p>
        </div>

        {/* Security badges */}
        <div className="flex flex-wrap justify-center gap-2">
          {[
            "🔐 AES-256-GCM",
            "🌐 Pinata IPFS",
            "🔒 Server-side only",
            "💎 Sui Testnet",
          ].map((badge) => (
            <span
              key={badge}
              className="px-3 py-1 text-xs bg-white/5 border border-white/10 rounded-full text-gray-400"
            >
              {badge}
            </span>
          ))}
        </div>

        {/* Form */}
        <div className="glass-card rounded-2xl p-8">
          <CreateVideoForm />
        </div>

        {/* Info */}
        <div className="glass-card rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-medium text-gray-300">
            📋 Before you create
          </h3>
          <ul className="space-y-2 text-xs text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-yellow-400 mt-0.5">⚠️</span>
              <span>
                Set your YouTube video to <strong className="text-white">Unlisted</strong> before
                adding it here. Private videos cannot be embedded.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">ℹ️</span>
              <span>
                The YouTube URL is encrypted immediately — it never appears in
                logs or responses.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>
                Revenue cap is $20 USD gross. After that, no new purchases are
                allowed but existing access remains valid.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">💎</span>
              <span>
                Payments are split: 90% to you, 10% platform fee. All on Sui
                testnet.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
