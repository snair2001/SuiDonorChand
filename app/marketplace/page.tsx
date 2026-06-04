"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { VideoCard } from "@/components/VideoCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import Link from "next/link";
import { getCampaigns, SafeVideoMetadata } from "@/lib/sui";
import { getThumbnailUrl } from "@/lib/youtube";

interface AccessMap {
  [id: string]: { hasAccess: boolean; expiresAt: string | null; isExpired: boolean; };
}

export default function MarketplacePage() {
  const [campaigns, setCampaigns] = useState<SafeVideoMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessMap, setAccessMap] = useState<AccessMap>({});

  const fetchCampaigns = useCallback(async () => {
    try {
      const data = await getCampaigns();
      setCampaigns(data);
    } catch { toast.error("Failed to load campaigns"); }
    finally { setLoading(false); }
  }, []);

  const fetchAccess = useCallback(async (ids: string[]) => {
    const results: AccessMap = {};
    await Promise.all(ids.map(async id => {
      try {
        const res = await fetch(`/api/videos/${id}/access`);
        const data = await res.json();
        results[id] = { hasAccess: data.hasAccess || false, expiresAt: data.expiresAt || null, isExpired: data.isExpired || false };
      } catch { results[id] = { hasAccess: false, expiresAt: null, isExpired: false }; }
    }));
    setAccessMap(results);
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    if (campaigns.length > 0) fetchAccess(campaigns.map(v => v.videoId));
  }, [campaigns, fetchAccess]);

  const getAccessStatus = (id: string): "none" | "active" | "expired" => {
    const a = accessMap[id];
    if (!a) return "none";
    if (a.hasAccess) return "active";
    if (a.isExpired) return "expired";
    return "none";
  };

  // Permanently hidden campaigns
  const BLOCKED_VIDEO_IDS = new Set([
    "95f75943-b013-41fe-9505-5e942fa97e0b",
    "e62913dc-14e9-4e58-9d56-c61415331a0d",
    "83c479b8-5da8-477e-93db-cb9bfedd8a26",
    "3065057e-bf03-4429-9ccd-ed28fb7d4f75",
    "202e629e-9c4a-4dee-bc42-8efa83feb64c",
    "e83b111d-9f6f-4bb9-988c-3bbd1b184596",
  ]);

  const visible = campaigns.filter(v => !v.isDisabled && !BLOCKED_VIDEO_IDS.has(v.videoId));

  return (
    <div className="page">
      <div className="container">
        {/* Header */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "2.5rem" }}>
          <div>
            <h1 style={{ fontSize: "clamp(1.75rem, 4vw, 2.25rem)", fontWeight: 800, color: "#f8fafc" }}>Marketplace</h1>
            <p style={{ color: "#64748b", marginTop: "0.375rem" }}>Pay with Slush wallet — get time-limited access instantly via Sui Testnet</p>
          </div>
          <Link href="/login" className="btn btn-primary">Login to Purchase</Link>
        </div>

        {/* Loading */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6rem 0", gap: "1rem" }}>
            <LoadingSpinner size="lg" />
            <p style={{ color: "#475569" }}>Loading from Sui Testnet...</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎬</div>
            <h2 className="empty-title">No campaigns yet</h2>
            <p className="empty-desc">Be the first to create an encrypted video listing on Sui Testnet</p>
            <Link href="/create" className="btn btn-primary" style={{ marginTop: "0.5rem" }}>Create Campaign</Link>
          </div>
        ) : (
          <>
            {/* Stats bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
                <strong style={{ color: "#f8fafc" }}>{visible.length}</strong> campaign{visible.length !== 1 ? "s" : ""} available
              </span>
              <span style={{ fontSize: "0.875rem", color: "#a855f7" }}>
                <strong>{Object.values(accessMap).filter(a => a.hasAccess).length}</strong> active access
              </span>
            </div>

            <div className="video-grid">
              {visible.map(campaign => (
                <VideoCard
                  key={campaign.videoId}
                  videoId={campaign.videoId}
                  campaignId={campaign.campaignId}
                  title={campaign.title}
                  creatorAddress={campaign.creatorAddress}
                  priceMist={campaign.priceMist}
                  durationMs={campaign.durationHours * 60 * 60 * 1000}
                  isSoldOut={false}
                  isDisabled={campaign.isDisabled}
                  status={campaign.isDisabled ? "disabled" : "active"}
                  createdAt={new Date().toISOString()}
                  thumbnailUrl={getThumbnailUrl(campaign.thumbnailVideoId)}
                  accessStatus={getAccessStatus(campaign.videoId)}
                  expiresAt={accessMap[campaign.videoId]?.expiresAt}
                />
              ))}
            </div>

            <p style={{ textAlign: "center", fontSize: "0.8125rem", color: "#334155", marginTop: "3rem", paddingTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              Payments via Slush wallet on Sui Testnet · All data stored on-chain on Sui
            </p>
          </>
        )}
      </div>
    </div>
  );
}
