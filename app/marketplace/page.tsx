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
}

export default function MarketplacePage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [accessMap, setAccessMap] = useState<AccessMap>({});
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [txDigest, setTxDigest] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    try {
      const res = await fetch("/api/videos/list");
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
            results[videoId] = {
              hasAccess: false,
              expiresAt: null,
              isExpired: false,
            };
          }
        })
      );
      setAccessMap(results);
    },
    [user]
  );

  useEffect(() => {
    // Check auth
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

  const handlePurchase = async (videoId: string) => {
    if (!user) {
      toast.error("Please login to purchase access");
      return;
    }

    const video = videos.find((v) => v.videoId === videoId);
    if (!video) return;

    setPurchasingId(videoId);

    try {
      // In development with ALLOW_MOCK_PAYMENT=true, use mock transaction
      // In production, this would use the Sui wallet SDK to sign a real transaction
      let digest: string;

      const isMockMode =
        process.env.NODE_ENV === "development" ||
        window.location.hostname === "localhost";

      if (isMockMode) {
        // Mock payment for development
        digest = `MOCK_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        toast.info("Using mock payment (development mode)");
      } else {
        // Production: Use Sui wallet to sign transaction
        // This requires the user to have a Sui wallet extension or zkLogin signing
        toast.error(
          "Production payment requires Sui wallet integration. See README for setup."
        );
        setPurchasingId(null);
        return;
      }

      // Record payment on backend
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

      // Update access map
      setAccessMap((prev) => ({
        ...prev,
        [videoId]: {
          hasAccess: true,
          expiresAt: data.access.expiresAt,
          isExpired: false,
        },
      }));

      // Refresh videos to get updated revenue
      fetchVideos();
    } catch {
      toast.error("Purchase failed. Please try again.");
    } finally {
      setPurchasingId(null);
    }
  };

  const getAccessStatus = (
    videoId: string
  ): "none" | "active" | "expired" => {
    const access = accessMap[videoId];
    if (!access) return "none";
    if (access.hasAccess) return "active";
    if (access.isExpired) return "expired";
    return "none";
  };

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

          {!user && (
            <Link
              href="/login"
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-sm font-medium rounded-xl transition-all"
            >
              Login to Purchase
            </Link>
          )}
        </div>

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
              <p className="text-gray-400 text-sm">
                Loading from Pinata IPFS...
              </p>
            </div>
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="text-5xl">🎬</div>
            <h2 className="text-2xl font-semibold text-white">
              No videos yet
            </h2>
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
              <span>{videos.length} video{videos.length !== 1 ? "s" : ""} available</span>
              {user && (
                <span className="text-purple-400">
                  {
                    Object.values(accessMap).filter((a) => a.hasAccess).length
                  }{" "}
                  active access
                </span>
              )}
            </div>

            {/* Video grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {videos.map((video) => (
                <VideoCard
                  key={video.videoId}
                  videoId={video.videoId}
                  title={video.title}
                  creatorAddress={video.creatorAddress}
                  priceMist={video.priceMist}
                  durationMs={video.durationMs}
                  isSoldOut={video.isSoldOut}
                  status={video.status}
                  createdAt={video.createdAt}
                  thumbnailUrl={video.thumbnailUrl}
                  accessStatus={getAccessStatus(video.videoId)}
                  expiresAt={accessMap[video.videoId]?.expiresAt}
                  onPurchase={user ? handlePurchase : undefined}
                  isPurchasing={purchasingId === video.videoId}
                />
              ))}
            </div>
          </>
        )}

        {/* Info footer */}
        {!loading && videos.length > 0 && (
          <div className="text-center text-xs text-gray-600 pt-4 border-t border-white/5">
            All video metadata stored on Pinata IPFS • Payments on Sui Testnet
            • Revenue cap: $20 USD per video
          </div>
        )}
      </div>
    </div>
  );
}
