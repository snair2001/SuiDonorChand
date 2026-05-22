"use client";

import { useState, useEffect, useCallback } from "react";
import { LoadingSpinner } from "./LoadingSpinner";
import Link from "next/link";

interface SecureVideoPlayerProps {
  videoId: string;
}

interface PlayData {
  embedUrl: string;
  expiresAt: string;
  title: string;
}

export function SecureVideoPlayer({ videoId }: SecureVideoPlayerProps) {
  const [playData, setPlayData] = useState<PlayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState("Verifying access...");
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState("");

  const fetchPlayData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadingMsg("Verifying access...");

    try {
      // The play route retries internally for up to ~18s
      // Show progressive messages to the user
      const msgTimer1 = setTimeout(() => setLoadingMsg("Confirming payment on IPFS..."), 4000);
      const msgTimer2 = setTimeout(() => setLoadingMsg("Almost there..."), 10000);

      const res = await fetch(`/api/videos/${videoId}/play`);
      clearTimeout(msgTimer1);
      clearTimeout(msgTimer2);

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || "Access denied");
        return;
      }
      setPlayData(data);
    } catch {
      setError("Failed to load video. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => { fetchPlayData(); }, [fetchPlayData]);

  // Countdown timer
  useEffect(() => {
    if (!playData?.expiresAt) return;
    const update = () => {
      const diff = new Date(playData.expiresAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Expired"); setPlayData(null); setError("Your access has expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [playData?.expiresAt]);

  if (loading) return (
    <div style={{ aspectRatio: "16/9", background: "rgba(0,0,0,0.4)", borderRadius: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
        <LoadingSpinner size="lg" />
        <p style={{ color: "#94a3b8", fontSize: "0.9375rem" }}>{loadingMsg}</p>
        <p style={{ color: "#475569", fontSize: "0.8125rem" }}>This may take up to 20 seconds after payment</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ aspectRatio: "16/9", background: "rgba(0,0,0,0.4)", borderRadius: "1rem", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", padding: "2rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
        <div style={{ fontSize: "3.5rem" }}>🔒</div>
        <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#f8fafc" }}>Access Denied</h3>
        <p style={{ color: "#64748b", fontSize: "0.9375rem", maxWidth: "28rem" }}>{error}</p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={fetchPlayData}
            className="btn btn-primary btn-sm"
          >
            🔄 Try Again
          </button>
          <Link href="/marketplace" className="btn btn-outline btn-sm">
            Go to Marketplace
          </Link>
        </div>
      </div>
    </div>
  );

  if (!playData) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      {/* Timer bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4ade80", display: "inline-block" }} className="animate-pulse" />
          <span style={{ fontSize: "0.875rem", color: "#4ade80", fontWeight: 500 }}>Active Access</span>
        </div>
        <div style={{ fontSize: "0.875rem", color: "#94a3b8" }}>
          Expires in: <span style={{ fontFamily: "monospace", color: "#4ade80", fontWeight: 600 }}>{timeLeft}</span>
        </div>
      </div>

      {/* Player */}
      <div style={{ position: "relative", aspectRatio: "16/9", background: "#000", borderRadius: "1rem", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
        <iframe
          src={playData.embedUrl}
          title={playData.title}
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      <p style={{ fontSize: "0.75rem", color: "#334155", textAlign: "center" }}>
        🔐 Served via encrypted IPFS metadata · Access expires {new Date(playData.expiresAt).toLocaleString()}
      </p>
    </div>
  );
}
