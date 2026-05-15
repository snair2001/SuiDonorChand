/**
 * Video registry utilities
 * Wraps Pinata registry functions with business logic
 */

import {
  getLatestRegistry,
  getVideoMetadata,
  updateVideoRegistry,
  uploadJsonToPinata,
  VideoMetadata,
  RegistryEntry,
} from "./pinata";
import { encryptText } from "./encryption";
import { validateYouTubeUrl, extractYouTubeId, getThumbnailUrl } from "./youtube";
import { suiToMist, mistToSui } from "./pricing";

export interface CreateVideoParams {
  title: string;
  description: string;
  youtubeUrl: string;
  priceSui: number;
  durationHours: number;
  creatorEmail: string;
  creatorAddress: string;
}

export interface SafeVideoMetadata {
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
  status: string;
  createdAt: string;
  thumbnailUrl?: string;
}

/**
 * Create a new video with encrypted metadata
 */
export async function createVideo(
  params: CreateVideoParams
): Promise<SafeVideoMetadata> {
  const { v4: uuidv4 } = await import("uuid");

  // Validate YouTube URL
  const ytValidation = validateYouTubeUrl(params.youtubeUrl);
  if (!ytValidation.valid || !ytValidation.videoId) {
    throw new Error(ytValidation.error || "Invalid YouTube URL");
  }

  // Encrypt the YouTube URL
  const encrypted = encryptText(params.youtubeUrl);

  const videoId = uuidv4();
  const priceMist = suiToMist(params.priceSui);
  const durationMs = params.durationHours * 60 * 60 * 1000;
  const revenueCapUsd = parseFloat(
    process.env.VIDEO_REVENUE_CAP_USD || "20"
  );
  const platformFeePercentage = parseFloat(
    process.env.PLATFORM_FEE_PERCENTAGE || "10"
  );

  const metadata: VideoMetadata = {
    videoId,
    title: params.title.trim(),
    description: params.description.trim(),
    creatorEmail: params.creatorEmail,
    creatorAddress: params.creatorAddress,
    encryptedUrl: encrypted.encryptedText,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    priceMist: priceMist.toString(),
    priceSui: params.priceSui.toString(),
    durationMs,
    revenueCapUsd,
    totalGrossRevenueUsd: 0,
    totalCreatorRevenueUsd: 0,
    totalPlatformRevenueUsd: 0,
    purchaseCount: 0,
    isSoldOut: false,
    status: "active",
    removedReason: null,
    removedAt: null,
    createdAt: new Date().toISOString(),
    thumbnailVideoId: ytValidation.videoId,
  };

  // Upload encrypted metadata to Pinata
  const cid = await uploadJsonToPinata(metadata, `video-metadata-${videoId}`);

  // Update registry
  const registryEntry: RegistryEntry = {
    videoId,
    cid,
    title: metadata.title,
    creatorAddress: metadata.creatorAddress,
    priceMist: metadata.priceMist,
    durationMs: metadata.durationMs,
    status: "active",
    isSoldOut: false,
    createdAt: metadata.createdAt,
    thumbnailVideoId: ytValidation.videoId,
  };

  await updateVideoRegistry(registryEntry);

  return {
    videoId,
    cid,
    title: metadata.title,
    description: metadata.description,
    creatorAddress: metadata.creatorAddress,
    priceMist: metadata.priceMist,
    priceSui: metadata.priceSui,
    durationMs: metadata.durationMs,
    durationHours: params.durationHours,
    revenueCapUsd: metadata.revenueCapUsd,
    totalGrossRevenueUsd: 0,
    totalCreatorRevenueUsd: 0,
    totalPlatformRevenueUsd: 0,
    purchaseCount: 0,
    isSoldOut: false,
    status: "active",
    createdAt: metadata.createdAt,
    thumbnailUrl: getThumbnailUrl(ytValidation.videoId),
  };
}

/**
 * Get safe (non-sensitive) video metadata
 */
export async function getSafeVideoMetadata(
  videoId: string
): Promise<SafeVideoMetadata | null> {
  const result = await getVideoMetadata(videoId);
  if (!result) return null;

  const { metadata, cid } = result;
  const thumbnailUrl = metadata.thumbnailVideoId
    ? getThumbnailUrl(metadata.thumbnailVideoId)
    : undefined;

  return {
    videoId: metadata.videoId,
    cid,
    title: metadata.title,
    description: metadata.description,
    creatorAddress: metadata.creatorAddress,
    priceMist: metadata.priceMist,
    priceSui: metadata.priceSui,
    durationMs: metadata.durationMs,
    durationHours: metadata.durationMs / (60 * 60 * 1000),
    revenueCapUsd: metadata.revenueCapUsd,
    totalGrossRevenueUsd: metadata.totalGrossRevenueUsd,
    totalCreatorRevenueUsd: metadata.totalCreatorRevenueUsd,
    totalPlatformRevenueUsd: metadata.totalPlatformRevenueUsd,
    purchaseCount: metadata.purchaseCount,
    isSoldOut: metadata.isSoldOut,
    status: metadata.status,
    createdAt: metadata.createdAt,
    thumbnailUrl,
  };
}

/**
 * Get all active videos from registry (safe metadata only)
 */
export async function getActiveVideos(): Promise<SafeVideoMetadata[]> {
  const registry = await getLatestRegistry();
  const activeEntries = registry.videos.filter(
    (v) => v.status === "active" && !v.isSoldOut
  );

  const videos: SafeVideoMetadata[] = activeEntries.map((entry) => ({
    videoId: entry.videoId,
    cid: entry.cid,
    title: entry.title,
    description: "",
    creatorAddress: entry.creatorAddress,
    priceMist: entry.priceMist,
    priceSui: mistToSui(BigInt(entry.priceMist)).toString(),
    durationMs: entry.durationMs,
    durationHours: entry.durationMs / (60 * 60 * 1000),
    revenueCapUsd: parseFloat(process.env.VIDEO_REVENUE_CAP_USD || "20"),
    totalGrossRevenueUsd: 0,
    totalCreatorRevenueUsd: 0,
    totalPlatformRevenueUsd: 0,
    purchaseCount: 0,
    isSoldOut: entry.isSoldOut,
    status: entry.status,
    createdAt: entry.createdAt,
    thumbnailUrl: entry.thumbnailVideoId
      ? getThumbnailUrl(entry.thumbnailVideoId)
      : undefined,
  }));

  return videos;
}

/**
 * Get all videos by creator address
 */
export async function getCreatorVideos(
  creatorAddress: string
): Promise<SafeVideoMetadata[]> {
  const registry = await getLatestRegistry();
  const creatorEntries = registry.videos.filter(
    (v) => v.creatorAddress.toLowerCase() === creatorAddress.toLowerCase()
  );

  return creatorEntries.map((entry) => ({
    videoId: entry.videoId,
    cid: entry.cid,
    title: entry.title,
    description: "",
    creatorAddress: entry.creatorAddress,
    priceMist: entry.priceMist,
    priceSui: mistToSui(BigInt(entry.priceMist)).toString(),
    durationMs: entry.durationMs,
    durationHours: entry.durationMs / (60 * 60 * 1000),
    revenueCapUsd: parseFloat(process.env.VIDEO_REVENUE_CAP_USD || "20"),
    totalGrossRevenueUsd: 0,
    totalCreatorRevenueUsd: 0,
    totalPlatformRevenueUsd: 0,
    purchaseCount: 0,
    isSoldOut: entry.isSoldOut,
    status: entry.status,
    createdAt: entry.createdAt,
    thumbnailUrl: entry.thumbnailVideoId
      ? getThumbnailUrl(entry.thumbnailVideoId)
      : undefined,
  }));
}
