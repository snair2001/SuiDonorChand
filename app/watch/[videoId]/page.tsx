"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { SecureVideoPlayer } from "@/components/SecureVideoPlayer";
import { PayButton } from "@/components/PayButton";
import { LoadingPage } from "@/components/LoadingSpinner";
import { toast } from "sonner";
import Link from "next/link";
import { formatSui } from "@/lib/pricing";

interface VideoInfo {
  videoId: string; title: string; description: string;
  creatorAddress: string; priceMist: string; durationMs: number;
  isSoldOut: boolean; isDisabled: boolean; status: string; createdAt: string;
}

interface AccessInfo {
  hasAccess: boolean;
  expiresAt: string | null;
  isExpired: boolean;
}

export default function WatchPage() {
  const router = useRouter();
  const params = useParams();
  const videoId = params.videoId as string;

  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  // ── Check access from the API ─────────────────────────────────────────────
  const checkAccess = useCallback(async () => {
    setAccessLoading(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/access`);
      const data = await res.json();
      setAccess({
        hasAccess: data.hasAccess || false,
        expiresAt: data.expiresAt || null,
        isExpired: data.isExpired || false,
      });
    } catch {
      setAccess({ hasAccess: false, expiresAt: null, isExpired: false });
    } finally {
      setAccessLoading(false);
    }
  }, [videoId]);

  // ── Init: verify session + load video + check access ─────────────────────
  useEffect(() => {
    const init = async () => {
      // 1. Verify session
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (!sessionData.user) {
          setLoading(false);
          router.replace(`/login?redirect=/watch/${videoId}`);
          return;
        }
      } catch {
        setLoading(false);
        setVideoError("Failed to verify session. Please refresh.");
        return;
      }

      setAuthed(true);

      // 2. Load video metadata + access in parallel
      await Promise.all([
        (async () => {
          try {
            const res = await fetch(`/api/videos/${videoId}`);
            const data = await res.json();
            if (!res.ok || !data.video) setVideoError("Video not found");
            else setVideo(data.video);
          } catch {
            setVideoError("Failed to load video information");
          }
        })(),
        checkAccess(),
      ]);

      setLoading(false);
    };
    init();
  }, [videoId, router, checkAccess]);

  // ── Handle payment success ────────────────────────────────────────────────
  const handlePaymentSuccess = async (txDigest: string) => {
    if (!video) return;
    setPurchasing(true);
    try {
      const res = await fetch("/api/payment/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, txDigest }),
      });
      const data = await res.json();

      if (res.status === 409) {
        // Transaction already processed — access record should exist.
        // Use the access from the 409 response if available, otherwise re-check.
        if (data.access?.hasAccess) {
          toast.success("Access confirmed!");
          setAccess({
            hasAccess: true,
            expiresAt: data.access.expiresAt ?? null,
            isExpired: false,
          });
          return;
        }
        toast.info("Payment already recorded. Checking your access...");
        await checkAccess();
        // If still not found after re-check, optimistically grant access —
        // the player's own retry loop will confirm within ~18s.
        setAccess((prev) =>
          prev?.hasAccess ? prev : { hasAccess: true, expiresAt: null, isExpired: false }
        );
        return;
      }

      if (!res.ok) {
        toast.error(data.error || "Failed to record payment");
        return;
      }

      toast.success("Payment recorded! Preparing your video...");
      setAccess({
        hasAccess: true,
        expiresAt: data.access?.expiresAt ?? null,
        isExpired: false,
      });
    } catch {
      toast.error("Failed to record payment. Please contact support with your tx digest.");
    } finally {
      setPurchasing(false);
    }
  };

  // ── Loading states ────────────────────────────────────────────────────────
  if (loading) return <LoadingPage message="Loading video..." />;
  if (!authed) return null;

  if (videoError) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div className="empty-state">
        <div className="empty-icon">❌</div>
        <h2 className="empty-title">{videoError}</h2>
        <Link href="/marketplace" className="btn btn-primary" style={{ marginTop: "0.5rem" }}>Back to Marketplace</Link>
      </div>
    </div>
  );

  const fmtAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;
  const fmtDuration = (ms: number) => {
    const h = ms / 3600000;
    return h < 24 ? `${h} hours` : `${Math.floor(h / 24)} days`;
  };
  const fmtExpiry = (d: string) => {
    const diff = new Date(d).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 24) return `${Math.floor(h / 24)}d left`;
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
  };

  const hasAccess = access?.hasAccess ?? false;
  const isDisabled = video?.isDisabled ?? false;
  const isSoldOut = video?.isSoldOut ?? false;

  return (
    <div className="page">
      <div className="container-lg">
        {/* Breadcrumb */}
        <div className="breadcrumb" style={{ marginBottom: "1.5rem" }}>
          <Link href="/marketplace" className="breadcrumb">Marketplace</Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current truncate" style={{ maxWidth: "280px" }}>
            {video?.title || videoId}
          </span>
        </div>

        {/* Title */}
        {video && (
          <div style={{ marginBottom: "1.5rem" }} className="stack-xs">
            <h1 style={{ fontSize: "clamp(1.375rem, 3vw, 1.875rem)", fontWeight: 800, color: "#f8fafc" }}>
              {video.title}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.875rem", color: "#64748b" }}>by {fmtAddr(video.creatorAddress)}</span>
              <span style={{ color: "#334155" }}>·</span>
              <span style={{ fontSize: "0.875rem", color: "#64748b" }}>{fmtDuration(video.durationMs)} access</span>
              {access?.hasAccess && access.expiresAt && (
                <>
                  <span style={{ color: "#334155" }}>·</span>
                  <span style={{ fontSize: "0.875rem", color: "#4ade80", fontWeight: 500 }}>
                    ⏱ {fmtExpiry(access.expiresAt)}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Main content: player OR pay gate ── */}
        {accessLoading ? (
          <div style={{ aspectRatio: "16/9", background: "rgba(0,0,0,0.4)", borderRadius: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#64748b" }}>Checking access...</p>
          </div>
        ) : hasAccess ? (
          <SecureVideoPlayer videoId={videoId} />
        ) : (
          /* ── Pay Gate ── */
          <div style={{ aspectRatio: "16/9", background: "rgba(0,0,0,0.5)", borderRadius: "1rem", border: "1px solid rgba(168,85,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", padding: "2rem", maxWidth: "26rem", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem" }}>
              <div style={{ fontSize: "3.5rem" }}>🔒</div>
              <div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f8fafc", marginBottom: "0.375rem" }}>
                  Purchase Access
                </h3>
                <p style={{ color: "#64748b", fontSize: "0.9375rem" }}>
                  {access?.isExpired
                    ? "Your access has expired. Renew to keep watching."
                    : `Pay to unlock ${fmtDuration(video?.durationMs ?? 0)} of access.`}
                </p>
              </div>

              {video && !isDisabled && !isSoldOut && (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {/* Price info */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: "0.75rem" }}>
                    <span style={{ fontSize: "0.875rem", color: "#94a3b8" }}>Price</span>
                    <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "#a855f7" }}>
                      {formatSui(video.priceMist)} SUI
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 1rem", background: "rgba(0,0,0,0.2)", borderRadius: "0.5rem" }}>
                    <span style={{ fontSize: "0.8125rem", color: "#475569" }}>Access duration</span>
                    <span style={{ fontSize: "0.8125rem", color: "#94a3b8" }}>{fmtDuration(video.durationMs)}</span>
                  </div>

                  {purchasing ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", padding: "0.875rem", background: "rgba(168,85,247,0.1)", borderRadius: "0.875rem" }}>
                      <div className="spinner spinner-sm" style={{ borderColor: "rgba(168,85,247,0.2)", borderTopColor: "#a855f7" }} />
                      <span style={{ color: "#a855f7", fontSize: "0.9375rem" }}>Recording payment...</span>
                    </div>
                  ) : (
                    <PayButton
                      videoId={video.videoId}
                      priceMist={video.priceMist}
                      creatorAddress={video.creatorAddress}
                      onSuccess={handlePaymentSuccess}
                    />
                  )}
                </div>
              )}

              {isDisabled && (
                <div className="badge badge-gray" style={{ padding: "0.625rem 1rem" }}>
                  🚫 This video has been disabled by the admin
                </div>
              )}
              {isSoldOut && !isDisabled && (
                <div className="badge badge-red" style={{ padding: "0.625rem 1rem" }}>
                  🔒 Sold Out — Revenue cap reached
                </div>
              )}

              <Link href="/marketplace" className="btn btn-outline btn-sm">
                ← Back to Marketplace
              </Link>

              {/* Recovery button for users who already paid but access isn't showing */}
              <button
                onClick={checkAccess}
                disabled={accessLoading}
                style={{ background: "none", border: "none", color: "#475569", fontSize: "0.8125rem", cursor: "pointer", textDecoration: "underline" }}
              >
                {accessLoading ? "Checking..." : "Already paid? Check access"}
              </button>
            </div>
          </div>
        )}

        {/* Description */}
        {video?.description && (
          <div className="card" style={{ padding: "1.5rem", marginTop: "1.5rem" }}>
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Description
            </h3>
            <p style={{ fontSize: "0.9375rem", color: "#64748b", lineHeight: 1.7 }}>{video.description}</p>
          </div>
        )}

        {/* Security info */}
        <div className="card" style={{ padding: "1.5rem", marginTop: "1.25rem" }}>
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#94a3b8", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            🔐 Security
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem" }}>
            {[
              "Video URL encrypted with AES-256-GCM, stored on Pinata IPFS",
              "Decryption happens server-side only — raw URL never reaches your browser",
              "Access verified on every request via Pinata IPFS records",
              "Payment recorded on Sui testnet blockchain",
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
                <span style={{ color: "#7c3aed", flexShrink: 0, marginTop: "2px" }}>•</span>
                <p style={{ fontSize: "0.8125rem", color: "#64748b", lineHeight: 1.6 }}>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
