"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { WalletStatus } from "@/components/WalletStatus";
import { VideoCard } from "@/components/VideoCard";
import { RevenueProgress } from "@/components/RevenueProgress";
import { LoadingPage, LoadingSpinner } from "@/components/LoadingSpinner";

interface User {
  email: string;
  suiAddress: string;
  isAdmin: boolean;
}

interface Video {
  videoId: string;
  cid: string;
  title: string;
  description: string;
  creatorAddress: string;
  priceMist: string;
  priceSui: string;
  durationMs: number;
  durationHours: number;
  revenueCapUsd: number;
  totalGrossRevenueUsd: number;
  totalCreatorRevenueUsd: number;
  totalPlatformRevenueUsd: number;
  purchaseCount: number;
  isSoldOut: boolean;
  isDisabled: boolean;
  status: string;
  createdAt: string;
  thumbnailUrl?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then(async (data) => {
        if (!data.user) {
          router.replace("/login");
          return;
        }
        setUser(data.user);
        setLoading(false);

        // Fetch creator's videos
        setVideosLoading(true);
        try {
          const res = await fetch("/api/videos/list?includeSoldOut=true");
          const vData = await res.json();
          if (vData.videos) {
            // Filter to creator's videos
            const creatorVideos = vData.videos.filter(
              (v: Video) =>
                v.creatorAddress.toLowerCase() ===
                data.user.suiAddress.toLowerCase()
            );
            setVideos(creatorVideos);
          }
        } catch {
          // ignore
        } finally {
          setVideosLoading(false);
        }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  const fetchVideoDetails = async (videoId: string) => {
    try {
      const res = await fetch(`/api/videos/${videoId}`);
      const data = await res.json();
      if (data.video) {
        setSelectedVideo(data.video);
      }
    } catch {
      // ignore
    }
  };

  if (loading) return <LoadingPage message="Loading dashboard..." />;
  if (!user) return null;

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-gray-400 mt-1">
              Manage your encrypted video listings
            </p>
            {user.isAdmin && (
              <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 text-xs bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 rounded-full">
                🛡️ Platform Admin
              </span>
            )}
          </div>
          <Link
            href="/create"
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium rounded-xl transition-all"
          >
            <span>+</span>
            Create Video
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Wallet & Stats */}
          <div className="space-y-6">
            <WalletStatus email={user.email} suiAddress={user.suiAddress} />

            {/* Quick stats */}
            <div className="glass-card rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-medium text-gray-300">
                Creator Stats
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-white">
                    {videos.length}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Total Videos</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-400">
                    {videos.filter((v) => v.status === "active").length}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Active</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-purple-400">
                    {videos
                      .reduce((sum, v) => sum + v.purchaseCount, 0)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Total Sales</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-400">
                    $
                    {videos
                      .reduce((sum, v) => sum + v.totalCreatorRevenueUsd, 0)
                      .toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Earned</p>
                </div>
              </div>
            </div>

            {/* Quick links */}
            <div className="glass-card rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-medium text-gray-300">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <Link
                  href="/create"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all text-sm"
                >
                  <span>🔐</span>
                  Encrypt New Video
                </Link>
                <Link
                  href="/marketplace"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all text-sm"
                >
                  <span>🛒</span>
                  Browse Marketplace
                </Link>
              </div>
            </div>
          </div>

          {/* Right: Videos */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                Your Videos
              </h2>
              {videosLoading && <LoadingSpinner size="sm" />}
            </div>

            {!videosLoading && videos.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center space-y-4">
                <div className="text-5xl">🎬</div>
                <h3 className="text-xl font-semibold text-white">
                  No videos yet
                </h3>
                <p className="text-gray-400 text-sm">
                  Create your first encrypted video listing
                </p>
                <Link
                  href="/create"
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-xl hover:from-purple-500 hover:to-blue-500 transition-all"
                >
                  Create Video
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {videos.map((video) => (
                  <div key={video.videoId} className="glass-card rounded-xl overflow-hidden">
                    <div className="p-5 space-y-4">
                      {/* Video header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white truncate">
                            {video.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                video.isDisabled
                                  ? "bg-gray-500/20 text-gray-400"
                                  : video.status === "active"
                                  ? "bg-green-500/20 text-green-400"
                                  : video.status === "sold_out"
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-gray-500/20 text-gray-400"
                              }`}
                            >
                              {video.isDisabled ? "disabled by admin" : video.status}
                            </span>
                            <span className="text-xs text-gray-500">
                              {video.purchaseCount} sales
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            selectedVideo?.videoId === video.videoId
                              ? setSelectedVideo(null)
                              : fetchVideoDetails(video.videoId)
                          }
                          className="text-xs text-gray-400 hover:text-white transition-colors shrink-0"
                        >
                          {selectedVideo?.videoId === video.videoId
                            ? "Hide"
                            : "Details"}
                        </button>
                      </div>

                      {/* Revenue progress */}
                      <RevenueProgress
                        totalGrossRevenueUsd={video.totalGrossRevenueUsd}
                        revenueCapUsd={video.revenueCapUsd}
                        totalCreatorRevenueUsd={video.totalCreatorRevenueUsd}
                        totalPlatformRevenueUsd={video.totalPlatformRevenueUsd}
                        purchaseCount={video.purchaseCount}
                        isSoldOut={video.isSoldOut}
                      />

                      {/* CID display */}
                      {selectedVideo?.videoId === video.videoId && (
                        <div className="pt-3 border-t border-white/10 space-y-2">
                          <p className="text-xs text-gray-500">IPFS CID</p>
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-blue-300 font-mono bg-blue-500/10 px-2 py-1 rounded flex-1 truncate">
                              {video.cid}
                            </code>
                            <button
                              onClick={() =>
                                navigator.clipboard.writeText(video.cid)
                              }
                              className="text-xs text-gray-400 hover:text-white transition-colors shrink-0"
                            >
                              Copy
                            </button>
                          </div>
                          <a
                            href={`https://gateway.pinata.cloud/ipfs/${video.cid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            View on IPFS →
                          </a>
                        </div>
                      )}
                    </div>
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
