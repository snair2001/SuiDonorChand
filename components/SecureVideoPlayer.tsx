"use client";

import { useState, useEffect, useCallback } from "react";
import { LoadingSpinner } from "./LoadingSpinner";

interface SecureVideoPlayerProps {
  videoId: string;
}

interface PlayData {
  embedUrl: string;
  expiresAt: string;
  title: string;
}

export function SecureVideoPlayer({ videoId }: SecureVideoPlayerProps) {
  const [playData, setPlayData] = useState<PlayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");

  const fetchPlayData = useCallback(async () => {
    try {
      const res = await fetch(`/api/videos/${videoId}/play`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || data.error || "Access denied");
        return;
      }

      setPlayData(data);
    } catch {
      setError("Failed to load video");
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  useEffect(() => {
    fetchPlayData();
  }, [fetchPlayData]);

  // Countdown timer
  useEffect(() => {
    if (!playData?.expiresAt) return;

    const updateTimer = () => {
      const now = new Date();
      const expiry = new Date(playData.expiresAt);
      const diffMs = expiry.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeLeft("Expired");
        setPlayData(null);
        setError("Your access has expired");
        return;
      }

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [playData?.expiresAt]);

  if (loading) {
    return (
      <div className="aspect-video bg-black/50 rounded-2xl flex items-center justify-center">
        <div className="text-center space-y-3">
          <LoadingSpinner size="lg" />
          <p className="text-gray-400 text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="aspect-video bg-black/50 rounded-2xl flex items-center justify-center border border-red-500/20">
        <div className="text-center space-y-4 p-8">
          <div className="text-5xl">🔒</div>
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Access Denied
            </h3>
            <p className="text-gray-400 text-sm">{error}</p>
          </div>
          <a
            href="/marketplace"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-xl hover:from-purple-500 hover:to-blue-500 transition-all"
          >
            Go to Marketplace
          </a>
        </div>
      </div>
    );
  }

  if (!playData) return null;

  return (
    <div className="space-y-4">
      {/* Access timer */}
      <div className="flex items-center justify-between px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm text-green-400">Active Access</span>
        </div>
        <div className="text-sm text-gray-300">
          <span className="text-gray-500">Expires in: </span>
          <span className="font-mono text-green-300">{timeLeft}</span>
        </div>
      </div>

      {/* Video player */}
      <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl">
        <iframe
          src={playData.embedUrl}
          title={playData.title}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      {/* Security notice */}
      <p className="text-xs text-gray-600 text-center">
        🔐 Video served via encrypted IPFS metadata • Access expires{" "}
        {new Date(playData.expiresAt).toLocaleString()}
      </p>
    </div>
  );
}
