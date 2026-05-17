"use client";

import { useState } from "react";
import Link from "next/link";
import { formatSui } from "@/lib/pricing";
import { toast } from "sonner";
import { SlushPayButton } from "./SlushPayButton";

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
  /** Called with txDigest after Slush wallet payment succeeds */
  onPaymentSuccess?: (videoId: string, txDigest: string) => void;
  isPurchasing?: boolean;
  // Admin props
  isAdmin?: boolean;
  onDisableToggle?: (videoId: string, disable: boolean) => void;
}

export function VideoCard({
  videoId,
  title,
  creatorAddress,
  priceMist,
  durationMs,
  isSoldOut,
  isDisabled,
  status,
  createdAt,
  thumbnailUrl,
  accessStatus = "none",
  expiresAt,
  onPaymentSuccess,
  isPurchasing = false,
  isAdmin = false,
  onDisableToggle,
}: VideoCardProps) {
  const [imgError, setImgError] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reason, setReason] = useState("");

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatDuration = (ms: number) => {
    const hours = ms / (1000 * 60 * 60);
    if (hours < 24) return `${hours}h access`;
    const days = Math.floor(hours / 24);
    return `${days}d access`;
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const formatExpiry = (expiryStr: string) => {
    const expiry = new Date(expiryStr);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffMs <= 0) return "Expired";
    if (diffHours > 24) return `${Math.floor(diffHours / 24)}d remaining`;
    if (diffHours > 0) return `${diffHours}h ${diffMins}m remaining`;
    return `${diffMins}m remaining`;
  };

  const handleDisableToggle = async (disable: boolean) => {
    if (disable && !reason.trim()) {
      setShowReasonInput(true);
      return;
    }
    setDisabling(true);
    try {
      const res = await fetch(`/api/admin/videos/${videoId}/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disable, reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update campaign");
        return;
      }
      toast.success(data.message);
      setShowReasonInput(false);
      setReason("");
      onDisableToggle?.(videoId, disable);
    } catch {
      toast.error("Network error");
    } finally {
      setDisabling(false);
    }
  };

  const getActionButton = () => {
    if (isDisabled) {
      return (
        <div className="w-full text-center px-4 py-2.5 text-sm text-gray-400 bg-gray-500/10 border border-gray-500/20 rounded-lg">
          🚫 Disabled by Admin
        </div>
      );
    }

    if (accessStatus === "active" && expiresAt) {
      return (
        <Link
          href={`/watch/${videoId}`}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-sm font-medium rounded-lg transition-all"
        >
          <span>▶</span>
          Watch Now
        </Link>
      );
    }

    if (accessStatus === "expired") {
      return (
        <div className="space-y-2">
          <div className="w-full text-center px-4 py-2 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            Access Expired
          </div>
          {!isSoldOut && onPaymentSuccess && (
            <SlushPayButton
              videoId={videoId}
              priceMist={priceMist}
              creatorAddress={creatorAddress}
              onSuccess={(digest) => onPaymentSuccess(videoId, digest)}
            />
          )}
        </div>
      );
    }

    if (isSoldOut || status === "sold_out") {
      return (
        <div className="w-full text-center px-4 py-2.5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
          🔒 Sold Out
        </div>
      );
    }

    if (onPaymentSuccess) {
      return (
        <SlushPayButton
          videoId={videoId}
          priceMist={priceMist}
          creatorAddress={creatorAddress}
          onSuccess={(digest) => onPaymentSuccess(videoId, digest)}
          disabled={isPurchasing}
        />
      );
    }

    return (
      <Link
        href="/marketplace"
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-sm font-medium rounded-lg transition-all"
      >
        View in Marketplace
      </Link>
    );
  };

  return (
    <div
      className={`glass-card rounded-xl overflow-hidden group transition-all duration-300 ${
        isDisabled
          ? "opacity-60 border-gray-500/20"
          : "hover:border-purple-500/30"
      }`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gradient-to-br from-purple-900/50 to-blue-900/50 overflow-hidden">
        {thumbnailUrl && !imgError ? (
          <img
            src={thumbnailUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-4xl opacity-30">🎬</div>
          </div>
        )}

        {/* Overlay badges */}
        <div className="absolute top-2 right-2 flex gap-1">
          {isDisabled && (
            <span className="px-2 py-0.5 text-xs bg-gray-700/90 text-gray-300 rounded-full backdrop-blur-sm">
              Disabled
            </span>
          )}
          {isSoldOut && !isDisabled && (
            <span className="px-2 py-0.5 text-xs bg-red-500/80 text-white rounded-full backdrop-blur-sm">
              Sold Out
            </span>
          )}
          {accessStatus === "active" && (
            <span className="px-2 py-0.5 text-xs bg-green-500/80 text-white rounded-full backdrop-blur-sm">
              ✓ Access
            </span>
          )}
        </div>

        {/* Duration badge */}
        <div className="absolute bottom-2 left-2">
          <span className="px-2 py-0.5 text-xs bg-black/60 text-gray-300 rounded-full backdrop-blur-sm">
            {formatDuration(durationMs)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-white text-sm line-clamp-2 leading-snug">
            {title}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            by {formatAddress(creatorAddress)}
          </p>
        </div>

        {/* Price & Date */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="text-purple-300 font-medium">
            {formatSui(priceMist)} SUI
          </span>
          <span>{formatDate(createdAt)}</span>
        </div>

        {/* Expiry countdown */}
        {accessStatus === "active" && expiresAt && (
          <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-2 py-1 text-center">
            ⏱ {formatExpiry(expiresAt)}
          </div>
        )}

        {/* Action button */}
        {getActionButton()}

        {/* ── Admin disable/enable section ─────────────────────────────── */}
        {isAdmin && (
          <div className="pt-2 border-t border-white/10 space-y-2">
            {showReasonInput && !isDisabled ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for disabling (optional)"
                  className="w-full px-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                  maxLength={200}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDisableToggle(true)}
                    disabled={disabling}
                    className="flex-1 px-3 py-1.5 text-xs bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-all disabled:opacity-50"
                  >
                    {disabling ? "Disabling..." : "Confirm Disable"}
                  </button>
                  <button
                    onClick={() => {
                      setShowReasonInput(false);
                      setReason("");
                    }}
                    className="px-3 py-1.5 text-xs border border-white/10 text-gray-400 hover:text-white rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() =>
                  isDisabled
                    ? handleDisableToggle(false)
                    : handleDisableToggle(true)
                }
                disabled={disabling}
                className={`w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-all disabled:opacity-50 ${
                  isDisabled
                    ? "bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-500/30"
                    : "bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30"
                }`}
              >
                {disabling
                  ? "Updating..."
                  : isDisabled
                  ? "🟢 Re-enable Campaign"
                  : "🔴 Disable Campaign"}
              </button>
            )}
            <p className="text-xs text-gray-600 text-center">Admin only</p>
          </div>
        )}
      </div>
    </div>
  );
}
