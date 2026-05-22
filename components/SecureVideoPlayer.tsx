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
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState("");

  const [retrying, setRetrying] = useState(false);

  const fetchPlayData = useCallback(async () => {
    try {
      // The play route already retries internally (Pinata indexing lag)
      // Show a "verifying access" message while it works
      const res = await fetch(`/api/videos/${videoId}/play`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || "Access denied");
        return;
      }
      setPlayData(data);
    } catch {
      setError("Failed to load video");
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, [videoId]);

  useEffect(() => { fetchPlayData(); }, [fetchPlayData]);

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
      <div style={{ textAlign: "center" }} className="stack-sm">
        <LoadingSpinner size="lg" />
        <p style={{ color: "#64748b", fontSize: "0.875rem" }}>Verifying access...</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ aspectRatio: "16/9", background: "rgba(0,0,0,0.4)", borderRadius: "1rem", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", padding: "2rem" }} className="stack">
        <div style={{ fontSize: "3.5rem" }}>🔒</div>
        <h3 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#f8fafc" }}>Access Denied</h3>
        <p style={{ color: "#64748b", fontSize: "0.9375rem" }}>{error}</p>
        <Link href="/marketplace" className="btn btn-primary" style={{ display: "inline-flex", marginTop: "0.5rem" }}>
          Go to Marketplace
        </Link>
      </div>
    </div>
  );

  if (!playData) return null;

  return (
    <div className="stack-sm">
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
