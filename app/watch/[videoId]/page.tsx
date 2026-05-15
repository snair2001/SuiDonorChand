"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { SecureVideoPlayer } from "@/components/SecureVideoPlayer";
import { LoadingPage } from "@/components/LoadingSpinner";
import Link from "next/link";

interface VideoInfo {
  videoId: string;
  title: string;
  description: string;
  creatorAddress: string;
  priceMist: string;
  durationMs: number;
  isSoldOut: boolean;
  status: string;
  createdAt: string;
}

export default function WatchPage() {
  const router = useRouter();
  const params = useParams();
  const videoId = params.videoId as string;

  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      // Check auth
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();

      if (!sessionData.user) {
        router.replace(`/login?redirect=/watch/${videoId}`);
        return;
      }

      setAuthed(true);

      // Fetch video info
      try {
        const videoRes = await fetch(`/api/videos/${videoId}`);
        const videoData = await videoRes.json();

        if (!videoRes.ok || !videoData.video) {
          setVideoError("Video not found");
        } else {
          setVideo(videoData.video);
        }
      } catch {
        setVideoError("Failed to load video information");
      }

      setLoading(false);
    };

    init();
  }, [videoId, router]);

  if (loading) return <LoadingPage message="Loading video..." />;
  if (!authed) return null;

  if (videoError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="text-5xl">❌</div>
          <h2 className="text-2xl font-semibold text-white">{videoError}</h2>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-xl"
          >
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatDuration = (ms: number) => {
    const hours = ms / (1000 * 60 * 60);
    if (hours < 24) return `${hours} hours`;
    return `${Math.floor(hours / 24)} days`;
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/marketplace" className="hover:text-gray-300 transition-colors">
            Marketplace
          </Link>
          <span>/</span>
          <span className="text-gray-300 truncate max-w-xs">
            {video?.title || videoId}
          </span>
        </div>

        {/* Video title */}
        {video && (
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white">{video.title}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span>by {formatAddress(video.creatorAddress)}</span>
              <span>•</span>
              <span>{formatDuration(video.durationMs)} access</span>
            </div>
          </div>
        )}

        {/* Secure player */}
        <SecureVideoPlayer videoId={videoId} />

        {/* Video description */}
        {video?.description && (
          <div className="glass-card rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-medium text-gray-300">Description</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              {video.description}
            </p>
          </div>
        )}

        {/* Security info */}
        <div className="glass-card rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-medium text-gray-300">
            🔐 Security Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-400">
            <div className="flex items-start gap-2">
              <span className="text-purple-400">•</span>
              <span>
                Video URL encrypted with AES-256-GCM, stored on Pinata IPFS
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-purple-400">•</span>
              <span>
                Decryption happens server-side only — raw URL never reaches
                your browser
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-purple-400">•</span>
              <span>
                Access verified on every request via Pinata IPFS records
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-purple-400">•</span>
              <span>
                Payment recorded on Sui testnet blockchain
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
