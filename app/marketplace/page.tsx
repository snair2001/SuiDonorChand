"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { VideoCard } from "@/components/VideoCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import Link from "next/link";

interface Video {
  videoId: string;
  cid: string;
  title: string;
  description: string;
  creatorAddress: string;
  priceMist: string;
  priceSui: string;
  durationMs: number;
  isSoldOut: boolean;
  isDisabled: boolean;
  status: string;
  createdAt: string;
  thumbnailUrl?: string;
}

interface AccessMap {
  [videoId: string]: {
    hasAccess: boolean;
    expiresAt: string | null;
    isExpired: boolean;
  };
}

interface User {
  email: string;
  suiAddress: string;
  isAdmin: boolean;
}

export default function MarketplacePage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [accessMap, setAccessMap] = useState<AccessMap>({});
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [showDisabled, setShowDisabled] = useState(false);

  const fetchVideos = useCallback(async (includeDisabled = false) => {
    try {
      const url = includeDisabled
        ? "/api/videos/list?includeDisabled=true"
        : "/api/videos/list";
      const res = await fetch(url);
      const data = await res.json();
      if (data.videos) {
        setVideos(data.videos);
      }
    } catch {
      toast.error("Failed to load videos");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAccess = useCallback(
    async (videoIds: string[]) => {
      if (!user) return;
      const results: AccessMap = {};
      await Promise.all(
        videoIds.map(async (videoId) => {
          try {
            const res = await fetch(`/api/videos/${videoId}/access`);
            const data = await res.json();
            results[videoId] = {
              hasAccess: data.hasAccess || false,
              expiresAt: data.expiresAt || null,
              isExpired: data.isExpired || false,
            };
          } catch {
            results[videoId] = { hasAccess: false, expiresAt: null, isExpired: false };
          }
        })
      );
      setAccessMap(results);
    },
    [user]
  );

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user || null);
      })
      .catch(() => {});

    fetchVideos();
  }, [fetchVideos]);

  useEffect(() => {
    if (user && videos.length > 0) {
      fetchAccess(videos.map((v) => v.videoId));
    }
  }, [user, videos, fetchAccess]);

  // When admin toggles showDisabled, refetch
  useEffect(() => {
    if (user?.isAdmin) {
      fetchVideos(showDisabled);
    }
  }, [showDisabled, user, fetchVideos]);

  const handlePurchase = async (videoId: string) => {
    if (!user) {
      toast.error("Please login to purchase access");
      return;
    }

    const video = videos.find((v) => v.videoId === videoId);
    if (!video) return;

    setPurchasingId(videoId);

    try {
      let digest: string;
      const isMockMode =
        process.env.NODE_ENV === "development" ||
        window.location.hostname === "localhost";

      if (isMockMode) {
        digest = `MOCK_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        toast.info("Using mock payment (development mode)");
      } else {
        toast.error("Production payment requires Sui wallet integration. See README.");
        setPurchasingId(null);
        return;
      }

      const res = await fetch("/api/payment/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, txDigest: digest }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Payment failed");
        return;
      }

      setTxDigest(digest);
      toast.success("Access granted! You can now watch the video.");

      setAccessMap((prev) => ({
        ...prev,
        [videoId]: {
          hasAccess: true,
          expiresAt: data.access.expiresAt,
          isExpired: false,
        },
      }));

      fetchVideos(showDisabled);
    } catch {
      toast.error("Purchase failed. Please try again.");
    } finally {
      setPurchasingId(null);
    }
  };

  const handleDisableToggle = (videoId: string, disabled: boolean) => {
    // Optimistically update local state
    setVideos((prev) =>
      prev.map((v) => (v.videoId === videoId ? { ...v, isDisabled: disabled } : v))
    );
  };

  const getAccessStatus = (videoId: string): "none" | "active" | "expired" => {
    const access = accessMap[videoId];
    if (!access) return "none";
    if (access.hasAccess) return "active";
    if (access.isExpired) return "expired";
    return "none";
  };

  // What the public sees vs what admin sees
  const visibleVideos = user?.isAdmin
    ? showDisabled
      ? videos
      : videos.filter((v) => !v.isDisabled)
    : videos.filter((v) => !v.isDisabled);

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Marketplace</h1>
            <p className="text-gray-400 mt-1">
              Encrypted video access — pay SUI, watch instantly
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Admin: toggle show disabled */}
            {user?.isAdmin && (
              <button
                onClick={() => setShowDisabled((v) => !v)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  showDisabled
                    ? "bg-red-500/20 border-red-500/40 text-red-300"
                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                }`}
              >
                {showDisabled ? "Hiding disabled" : "Show disabled"}
              </button>
            )}

            {!user && (
              <Link
                href="/login"
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-sm font-medium rounded-xl transition-all"
              >
                Login to Purchase
              </Link>
            )}
          </div>
        </div>

        {/* Admin badge */}
        {user?.isAdmin && (
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm text-yellow-300">
            <span>🛡️</span>
            <span>Admin view — disable buttons are visible only to you</span>
          </div>
        )}

        {/* Transaction digest notification */}
        {txDigest && (
          <div className="glass-card rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-green-400">✓</span>
              <div>
                <p className="text-sm text-white">Payment recorded</p>
                <code className="text-xs text-gray-400 font-mono">
                  {txDigest.slice(0, 40)}...
                </code>
              </div>
            </div>
            <button
              onClick={() => setTxDigest(null)}
              className="text-gray-500 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-4">
              <LoadingSpinner size="lg" />
              <p className="text-gray-400 text-sm">Loading from Pinata IPFS...</p>
            </div>
          </div>
        ) : visibleVideos.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="text-5xl">🎬</div>
            <h2 className="text-2xl font-semibold text-white">No videos yet</h2>
            <p className="text-gray-400">
              Be the first to create an encrypted video listing
            </p>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-xl hover:from-purple-500 hover:to-blue-500 transition-all"
            >
              Create Video
            </Link>
          </div>
        ) : (
          <>
            {/* Stats bar */}
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>
                {visibleVideos.length} video{visibleVideos.length !== 1 ? "s" : ""} available
              </span>
              {user && (
                <span className="text-purple-400">
                  {Object.values(accessMap).filter((a) => a.hasAccess).length} active access
                </span>
              )}
              {user?.isAdmin && showDisabled && (
                <span className="text-red-400">
                  {videos.filter((v) => v.isDisabled).length} disabled
                </span>
              )}
            </div>

            {/* Video grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {visibleVideos.map((video) => (
                <VideoCard
                  key={video.videoId}
                  videoId={video.videoId}
                  title={video.title}
                  creatorAddress={video.creatorAddress}
                  priceMist={video.priceMist}
                  durationMs={video.durationMs}
                  isSoldOut={video.isSoldOut}
                  isDisabled={video.isDisabled}
                  status={video.status}
                  createdAt={video.createdAt}
                  thumbnailUrl={video.thumbnailUrl}
                  accessStatus={getAccessStatus(video.videoId)}
                  expiresAt={accessMap[video.videoId]?.expiresAt}
                  onPurchase={user && !video.isDisabled ? handlePurchase : undefined}
                  isPurchasing={purchasingId === video.videoId}
                  isAdmin={user?.isAdmin}
                  onDisableToggle={handleDisableToggle}
                />
              ))}
            </div>
          </>
        )}

        {!loading && visibleVideos.length > 0 && (
          <div className="text-center text-xs text-gray-600 pt-4 border-t border-white/5">
            All video metadata stored on Pinata IPFS • Payments on Sui Testnet
            • Revenue cap: $20 USD per video
          </div>
        )}
      </div>
    </div>
  );
}
