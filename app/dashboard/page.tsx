"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WalletStatus } from "@/components/WalletStatus";
import { RevenueProgress } from "@/components/RevenueProgress";
import { LoadingPage, LoadingSpinner } from "@/components/LoadingSpinner";

interface User { email: string; suiAddress: string; isAdmin: boolean; }
interface Video {
  videoId: string; cid: string; title: string; creatorAddress: string;
  priceMist: string; priceSui: string; durationMs: number; durationHours: number;
  revenueCapUsd: number; totalGrossRevenueUsd: number; totalCreatorRevenueUsd: number;
  totalPlatformRevenueUsd: number; purchaseCount: number; isSoldOut: boolean;
  isDisabled: boolean; status: string; createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedCid, setCopiedCid] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [grantingAccess, setGrantingAccess] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session").then(r => r.json()).then(async data => {
      if (!data.user) { router.replace("/login"); return; }
      setUser(data.user);
      setLoading(false);
      setVideosLoading(true);
      try {
        const res = await fetch("/api/videos/creator");
        const vData = await res.json();
        if (vData.videos) {
          setVideos(vData.videos);
        }
      } catch { /* ignore */ }
      finally { setVideosLoading(false); }
    }).catch(() => router.replace("/login"));
  }, [router]);

  const copyCid = async (cid: string) => {
    await navigator.clipboard.writeText(cid);
    setCopiedCid(cid);
    setTimeout(() => setCopiedCid(null), 2000);
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset ALL site data? This will delete all videos and cannot be undone!")) {
      return;
    }
    setResetting(true);
    try {
      const res = await fetch("/api/admin/reset", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert("All data reset successfully!");
        // Refresh the page
        window.location.reload();
      } else {
        alert(data.error || "Failed to reset data");
      }
    } catch (err) {
      console.error("Reset error:", err);
      alert("Failed to reset data");
    } finally {
      setResetting(false);
    }
  };

  const handleGrantAccess = async (videoId: string) => {
    if (!confirm("Grant yourself admin access to this video for 24 hours?")) {
      return;
    }
    setGrantingAccess(videoId);
    try {
      const res = await fetch("/api/admin/grant-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Access granted successfully! Now you can watch the video!");
        // Redirect to watch page
        window.location.href = `/watch/${videoId}`;
      } else {
        alert(data.error || "Failed to grant access");
      }
    } catch (err) {
      console.error("Grant access error:", err);
      alert("Failed to grant access");
    } finally {
      setGrantingAccess(null);
    }
  };

  if (loading) return <LoadingPage message="Loading dashboard..." />;
  if (!user) return null;

  const totalSales = videos.reduce((s, v) => s + v.purchaseCount, 0);
  const totalEarned = videos.reduce((s, v) => s + v.totalCreatorRevenueUsd, 0);

  return (
    <div className="page">
      <div className="container">
        {/* Header */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "2.5rem" }}>
          <div>
            <h1 style={{ fontSize: "clamp(1.75rem, 4vw, 2.25rem)", fontWeight: 800, color: "#f8fafc" }}>Dashboard</h1>
            <p style={{ color: "#64748b", marginTop: "0.375rem" }}>Manage your encrypted video listings</p>
            {user.isAdmin && (
              <span className="badge badge-yellow" style={{ marginTop: "0.625rem", display: "inline-flex" }}>
                🛡️ Platform Admin
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {user.isAdmin && (
              <button
                onClick={handleReset}
                disabled={resetting}
                className="btn btn-outline"
                style={{ borderColor: "#f87171", color: "#f87171" }}
              >
                {resetting ? "Resetting..." : "🔄 Reset All Data"}
              </button>
            )}
            <Link href="/create" className="btn btn-primary">
              + Create Video
            </Link>
          </div>
        </div>

        <div className="sidebar-layout">
          {/* Sidebar */}
          <div className="stack-lg">
            <WalletStatus email={user.email} suiAddress={user.suiAddress} />

            {/* Stats */}
            <div className="card" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#94a3b8", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Creator Stats</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                {[
                  { label: "Total Videos", value: videos.length, color: "#f8fafc" },
                  { label: "Active", value: videos.filter(v => v.status === "active" && !v.isDisabled).length, color: "#4ade80" },
                  { label: "Total Sales", value: totalSales, color: "#a855f7" },
                  { label: "Earned", value: `$${totalEarned.toFixed(2)}`, color: "#60a5fa" },
                ].map(s => (
                  <div key={s.label} className="stat-card">
                    <p className="stat-value" style={{ color: s.color }}>{s.value}</p>
                    <p className="stat-label">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="card" style={{ padding: "1.25rem" }}>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick Actions</h3>
              <div className="stack-xs">
                {[
                  { href: "/create", icon: "🔐", label: "Encrypt New Video" },
                  { href: "/marketplace", icon: "🛒", label: "Browse Marketplace" },
                ].map(a => (
                  <Link key={a.href} href={a.href} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.625rem 0.75rem", borderRadius: "0.625rem", color: "#64748b", fontSize: "0.9375rem", transition: "all 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLAnchorElement).style.color = "#f8fafc"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = ""; (e.currentTarget as HTMLAnchorElement).style.color = "#64748b"; }}>
                    <span>{a.icon}</span>{a.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Videos list */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f8fafc" }}>Your Videos</h2>
              {videosLoading && <LoadingSpinner size="sm" />}
            </div>

            {!videosLoading && videos.length === 0 ? (
              <div className="card empty-state">
                <div className="empty-icon">🎬</div>
                <h3 className="empty-title">No videos yet</h3>
                <p className="empty-desc">Create your first encrypted video listing</p>
                <Link href="/create" className="btn btn-primary" style={{ marginTop: "0.5rem" }}>Create Video</Link>
              </div>
            ) : (
              <div className="stack">
                {videos.map(video => (
                  <div key={video.videoId} className="card" style={{ padding: "1.5rem" }}>
                    {/* Header row */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 className="truncate" style={{ fontWeight: 600, color: "#f8fafc", fontSize: "1rem" }}>{video.title}</h3>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginTop: "0.375rem", flexWrap: "wrap" }}>
                          <span className={`badge ${video.isDisabled ? "badge-gray" : video.status === "active" ? "badge-green" : video.status === "sold_out" ? "badge-red" : "badge-gray"}`} style={{ fontSize: "0.6875rem" }}>
                            {video.isDisabled ? "disabled" : video.status}
                          </span>
                          <span style={{ fontSize: "0.75rem", color: "#475569" }}>{video.purchaseCount} sales</span>
                          <span style={{ fontSize: "0.75rem", color: "#475569" }}>{video.priceSui} SUI</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedId(expandedId === video.videoId ? null : video.videoId)}
                        style={{ fontSize: "0.8125rem", color: "#6366f1", background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                      >
                        {expandedId === video.videoId ? "Hide" : "Details"}
                      </button>
                    </div>

                    <RevenueProgress
                      totalGrossRevenueUsd={video.totalGrossRevenueUsd}
                      revenueCapUsd={video.revenueCapUsd}
                      totalCreatorRevenueUsd={video.totalCreatorRevenueUsd}
                      totalPlatformRevenueUsd={video.totalPlatformRevenueUsd}
                      purchaseCount={video.purchaseCount}
                      isSoldOut={video.isSoldOut}
                    />

                    {expandedId === video.videoId && (
                      <div style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px solid rgba(255,255,255,0.07)" }} className="stack-sm">
                        <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap" }}>
                          {user.isAdmin && (
                            <button
                              onClick={() => handleGrantAccess(video.videoId)}
                              disabled={grantingAccess === video.videoId}
                              className="btn btn-outline btn-sm"
                              style={{ borderColor: "#4ade80", color: "#4ade80" }}
                            >
                              {grantingAccess === video.videoId ? "Granting Access..." : "🔓 Grant Access (Admin)"}
                            </button>
                          )}
                          <Link href={`/watch/${video.videoId}`} className="btn btn-outline btn-sm">
                            Watch Video
                          </Link>
                        </div>

                        <p style={{ fontSize: "0.75rem", color: "#475569", marginTop: "0.5rem" }}>IPFS CID</p>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                          <code className="mono" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{video.cid}</code>
                          <button onClick={() => copyCid(video.cid)} style={{ fontSize: "0.75rem", color: copiedCid === video.cid ? "#4ade80" : "#6366f1", background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                            {copiedCid === video.cid ? "✓ Copied" : "Copy"}
                          </button>
                        </div>
                        <a href={`https://gateway.pinata.cloud/ipfs/${video.cid}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.8125rem", color: "#6366f1" }}>
                          View on IPFS →
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
