"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { SecureVideoPlayer } from "@/components/SecureVideoPlayer";
import { PayButton } from "@/components/PayButton";
import { LoadingPage } from "@/components/LoadingSpinner";
import { toast } from "sonner";
import Link from "next/link";
import { formatSui } from "@/lib/pricing";
import { getCampaign, SafeVideoMetadata } from "@/lib/sui";

interface AccessInfo {
  hasAccess: boolean;
  expiresAt: string | null;
  isExpired: boolean;
}

export default function WatchPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const videoId = params.videoId as string;
  const campaignId = searchParams.get("campaignId") as string;

  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [campaign, setCampaign] = useState<SafeVideoMetadata | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  // The actual Slush wallet address that signs on-chain transactions
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // ── Check access from the API ─────────────────────────────────────────────
  const checkAccess = useCallback(async (buyerAddr?: string) => {
    setAccessLoading(true);
    const addr = buyerAddr ?? walletAddress;
    try {
      const url = addr
        ? `/api/videos/${videoId}/access?wallet=${encodeURIComponent(addr)}`
        : `/api/videos/${videoId}/access`;
      const res = await fetch(url);
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

  // ── Init: verify session + load campaign + check access ─────────────────────
  useEffect(() => {
    const init = async () => {
      // 1. Verify session
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (!sessionData.user) {
          setLoading(false);
          router.replace(`/login?redirect=/watch/${videoId}${campaignId ? `?campaignId=${campaignId}` : ""}`);
          return;
        }
      } catch {
        setLoading(false);
        setVideoError("Failed to verify session. Please refresh.");
        return;
      }

      setAuthed(true);

      // 2. Load campaign metadata + access in parallel
      await Promise.all([
        (async () => {
          try {
            if (campaignId) {
              const data = await getCampaign(campaignId);
              if (data) {
                setCampaign(data);
              } else {
                setVideoError("Campaign not found");
              }
            }
          } catch {
            setVideoError("Failed to load campaign information");
          }
        })(),
        checkAccess(),
      ]);

      setLoading(false);
    };
    init();
  }, [videoId, campaignId, router, checkAccess]);

  // ── Handle payment success ────────────────────────────────────────────────
  const handlePaymentSuccess = async (txDigest: string, buyerWalletAddress: string) => {
    console.log("[WatchPage] Payment success! txDigest:", txDigest.slice(0, 20) + "...");
    console.log("[WatchPage] Buyer wallet address:", buyerWalletAddress);
    setPurchasing(true);
    setWalletAddress(buyerWalletAddress);
    toast.success("Payment confirmed on Sui! Verifying access...");

    // Poll on-chain access — the Move contract writes the AccessRecord in the
    // same transaction, but RPC indexing can lag by a few seconds.
    const MAX_ATTEMPTS = 10;
    const DELAY_MS = 2000;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
      try {
        const res = await fetch(`/api/videos/${videoId}/access?wallet=${encodeURIComponent(buyerWalletAddress)}`);
        const data = await res.json();
        if (data.hasAccess) {
          setAccess({
            hasAccess: true,
            expiresAt: data.expiresAt ?? null,
            isExpired: false,
          });
          toast.success("Access confirmed!");
          setPurchasing(false);
          return;
        }
      } catch {
        // keep polling
      }
    }

    // Timed out — optimistically let the player try; it will show its own error if needed
    console.warn("[WatchPage] Access not confirmed after polling, setting optimistic access");
    setAccess({ hasAccess: true, expiresAt: null, isExpired: false });
    toast.info("Access is being confirmed. The video will load shortly.");
    setPurchasing(false);
  };

  // ── Loading states ────────────────────────────────────────────────────────
  if (loading) return <LoadingPage message="Loading campaign..." />;
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
  const isDisabled = campaign?.isDisabled ?? false;
  const isSoldOut = false;

  return (
    <div className="page">
      <div className="container-lg">
        {/* Breadcrumb */}
        <div className="breadcrumb" style={{ marginBottom: "1.5rem" }}>
          <Link href="/marketplace" className="breadcrumb">Marketplace</Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current truncate" style={{ maxWidth: "280px" }}>
            {campaign?.title || videoId}
          </span>
        </div>

        {/* Title */}
        {campaign && (
          <div style={{ marginBottom: "1.5rem" }} className="stack-xs">
            <h1 style={{ fontSize: "clamp(1.375rem, 3vw, 1.875rem)", fontWeight: 800, color: "#f8fafc" }}>
              {campaign.title}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.875rem", color: "#64748b" }}>by {fmtAddr(campaign.creatorAddress)}</span>
              <span style={{ color: "#334155" }}>·</span>
              <span style={{ fontSize: "0.875rem", color: "#64748b" }}>{fmtDuration(campaign.durationHours * 60 * 60 * 1000)} access</span>
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
          <SecureVideoPlayer
            videoId={videoId}
            walletAddress={walletAddress ?? undefined}
            onExpired={() => {
              setAccess({ hasAccess: false, expiresAt: null, isExpired: true });
              toast.info("Your access has expired. Purchase again to continue watching.");
            }}
          />
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
                    : `Pay to unlock ${fmtDuration((campaign?.durationHours ?? 0) * 60 * 60 * 1000)} of access.`}
                </p>
              </div>

              {campaign && !isDisabled && !isSoldOut && (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {/* Price info */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: "0.75rem" }}>
                    <span style={{ fontSize: "0.875rem", color: "#94a3b8" }}>Price</span>
                    <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "#a855f7" }}>
                      {formatSui(campaign.priceMist)} SUI
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 1rem", background: "rgba(0,0,0,0.2)", borderRadius: "0.5rem" }}>
                    <span style={{ fontSize: "0.8125rem", color: "#475569" }}>Access duration</span>
                    <span style={{ fontSize: "0.8125rem", color: "#94a3b8" }}>{fmtDuration(campaign.durationHours * 60 * 60 * 1000)}</span>
                  </div>

                  {purchasing ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", padding: "0.875rem", background: "rgba(168,85,247,0.1)", borderRadius: "0.875rem" }}>
                      <div className="spinner spinner-sm" style={{ borderColor: "rgba(168,85,247,0.2)", borderTopColor: "#a855f7" }} />
                      <span style={{ color: "#a855f7", fontSize: "0.9375rem" }}>Verifying access on-chain...</span>
                    </div>
                  ) : (
                    <PayButton
                      videoId={videoId}
                      campaignId={campaign.campaignId}
                      priceMist={campaign.priceMist}
                      creatorAddress={campaign.creatorAddress}
                      onSuccess={handlePaymentSuccess}
                    />
                  )}
                </div>
              )}

              {isDisabled && (
                <div className="badge badge-gray" style={{ padding: "0.625rem 1rem" }}>
                  🚫 This campaign has been disabled
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
        {campaign?.description && (
          <div className="card" style={{ padding: "1.5rem", marginTop: "1.5rem" }}>
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Description
            </h3>
            <p style={{ fontSize: "0.9375rem", color: "#64748b", lineHeight: 1.7 }}>{campaign.description}</p>
          </div>
        )}

        {/* Security info */}
        <div className="card" style={{ padding: "1.5rem", marginTop: "1.25rem" }}>
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#94a3b8", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            🔐 Security
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.75rem" }}>
            {[
              "All data stored on-chain on Sui testnet",
              "Payment recorded on Sui testnet blockchain",
              "Video URL encrypted with AES-256-GCM",
              "Decryption happens server-side only",
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
