"use client";

import { useState } from "react";
import Link from "next/link";
import { formatSui } from "@/lib/pricing";
import { toast } from "sonner";
import { PayButton } from "./PayButton";

interface VideoCardProps {
  videoId: string;
  title: string;
  creatorAddress: string;
  priceMist: string;
  durationMs: number;
  isSoldOut: boolean;
  isDisabled: boolean;
  status: string;
  createdAt: string;
  thumbnailUrl?: string;
  accessStatus?: "none" | "active" | "expired";
  expiresAt?: string | null;
  onPaymentSuccess?: (videoId: string, txDigest: string) => void;
  isPurchasing?: boolean;
  isAdmin?: boolean;
  onDisableToggle?: (videoId: string, disable: boolean) => void;
}

export function VideoCard({
  videoId, title, creatorAddress, priceMist, durationMs,
  isSoldOut, isDisabled, status, createdAt, thumbnailUrl,
  accessStatus = "none", expiresAt, onPaymentSuccess,
  isPurchasing = false, isAdmin = false, onDisableToggle,
}: VideoCardProps) {
  const [imgError, setImgError] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");

  const fmtAddr = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;
  const fmtDuration = (ms: number) => {
    const h = ms / 3600000;
    return h < 24 ? `${h}h access` : `${Math.floor(h / 24)}d access`;
  };
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const fmtExpiry = (d: string) => {
    const diff = new Date(d).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 24) return `${Math.floor(h / 24)}d left`;
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
  };

  const handleDisable = async (disable: boolean) => {
    if (disable && !reason.trim()) { setShowReason(true); return; }
    setDisabling(true);
    try {
      const res = await fetch(`/api/admin/videos/${videoId}/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disable, reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); return; }
      toast.success(data.message);
      setShowReason(false);
      setReason("");
      onDisableToggle?.(videoId, disable);
    } catch { toast.error("Network error"); }
    finally { setDisabling(false); }
  };

  const renderAction = () => {
    if (isDisabled) return (
      <div className="badge badge-gray" style={{ width: "100%", justifyContent: "center", padding: "0.625rem" }}>
        🚫 Disabled by Admin
      </div>
    );
    // Show Watch Now whenever access is active — even if expiresAt is null
    if (accessStatus === "active") return (
      <Link href={`/watch/${videoId}`} className="btn btn-success btn-full">
        ▶ Watch Now
      </Link>
    );
    if (accessStatus === "expired") return (
      <div className="stack-xs">
        <div className="badge badge-yellow" style={{ width: "100%", justifyContent: "center", padding: "0.5rem" }}>
          Access Expired
        </div>
        {!isSoldOut && onPaymentSuccess && (
          <PayButton videoId={videoId} priceMist={priceMist} creatorAddress={creatorAddress}
            onSuccess={(d) => onPaymentSuccess(videoId, d)} label="Renew Access" />
        )}
      </div>
    );
    if (isSoldOut || status === "sold_out") return (
      <div className="badge badge-red" style={{ width: "100%", justifyContent: "center", padding: "0.625rem" }}>
        🔒 Sold Out
      </div>
    );
    if (onPaymentSuccess) return (
      <PayButton videoId={videoId} priceMist={priceMist} creatorAddress={creatorAddress}
        onSuccess={(d) => onPaymentSuccess(videoId, d)} disabled={isPurchasing} />
    );
    return (
      <Link href="/marketplace" className="btn btn-primary btn-full">
        View in Marketplace
      </Link>
    );
  };

  return (
    <div
      className="card"
      style={{
        overflow: "hidden",
        opacity: isDisabled ? 0.65 : 1,
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={e => { if (!isDisabled) { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 32px rgba(168,85,247,0.15)"; } }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}
    >
      {/* Thumbnail */}
      <div className="thumb-wrap">
        {thumbnailUrl && !imgError ? (
          <img src={thumbnailUrl} alt={title} onError={() => setImgError(true)} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "3rem", opacity: 0.25 }}>🎬</div>
        )}
        {/* Badges */}
        <div style={{ position: "absolute", top: "0.625rem", right: "0.625rem", display: "flex", gap: "0.375rem" }}>
          {isDisabled && <span className="badge badge-gray" style={{ fontSize: "0.6875rem" }}>Disabled</span>}
          {isSoldOut && !isDisabled && <span className="badge badge-red" style={{ fontSize: "0.6875rem" }}>Sold Out</span>}
          {accessStatus === "active" && <span className="badge badge-green" style={{ fontSize: "0.6875rem" }}>✓ Access</span>}
        </div>
        {/* Duration */}
        <div style={{ position: "absolute", bottom: "0.625rem", left: "0.625rem" }}>
          <span style={{ fontSize: "0.75rem", background: "rgba(0,0,0,0.65)", color: "#cbd5e1", padding: "0.25rem 0.625rem", borderRadius: "9999px", backdropFilter: "blur(4px)" }}>
            {fmtDuration(durationMs)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "1.125rem" }} className="stack-sm">
        <div>
          <h3 className="line-clamp-2" style={{ fontWeight: 600, color: "#f8fafc", fontSize: "0.9375rem", lineHeight: 1.4 }}>{title}</h3>
          <p style={{ fontSize: "0.75rem", color: "#475569", marginTop: "0.25rem" }}>by {fmtAddr(creatorAddress)}</p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#a855f7" }}>{formatSui(priceMist)} SUI</span>
          <span style={{ fontSize: "0.75rem", color: "#475569" }}>{fmtDate(createdAt)}</span>
        </div>

        {accessStatus === "active" && expiresAt && (
          <div className="badge badge-green" style={{ width: "100%", justifyContent: "center", fontSize: "0.75rem" }}>
            ⏱ {fmtExpiry(expiresAt)}
          </div>
        )}

        {renderAction()}

        {/* Admin controls */}
        {isAdmin && (
          <div style={{ paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.07)" }} className="stack-xs">
            {showReason && !isDisabled ? (
              <>
                <input
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="input"
                  style={{ fontSize: "0.8125rem", padding: "0.5rem 0.75rem" }}
                  maxLength={200}
                />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={() => handleDisable(true)} disabled={disabling} className="btn btn-danger btn-sm" style={{ flex: 1 }}>
                    {disabling ? "..." : "Confirm Disable"}
                  </button>
                  <button onClick={() => { setShowReason(false); setReason(""); }} className="btn btn-outline btn-sm">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => isDisabled ? handleDisable(false) : handleDisable(true)}
                disabled={disabling}
                className={`btn btn-sm btn-full ${isDisabled ? "btn-success" : "btn-danger"}`}
              >
                {disabling ? "Updating..." : isDisabled ? "🟢 Re-enable Campaign" : "🔴 Disable Campaign"}
              </button>
            )}
            <p style={{ fontSize: "0.6875rem", color: "#334155", textAlign: "center" }}>Admin only</p>
          </div>
        )}
      </div>
    </div>
  );
}
