/**
 * Pinata IPFS utilities
 * Server-side only — PINATA_JWT must never reach the frontend
 */

const PINATA_API_URL = "https://api.pinata.cloud";
const PINATA_GATEWAY = process.env.PINATA_GATEWAY_URL || "https://gateway.pinata.cloud";

function getPinataJwt(): string {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error("PINATA_JWT is not configured");
  return jwt;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VideoMetadata {
  videoId: string;
  title: string;
  description: string;
  creatorEmail: string;
  creatorAddress: string;
  encryptedUrl: string;
  iv: string;
  authTag: string;
  priceMist: string;
  priceSui: string;
  durationMs: number;
  revenueCapUsd: number;
  totalGrossRevenueUsd: number;
  totalCreatorRevenueUsd: number;
  totalPlatformRevenueUsd: number;
  purchaseCount: number;
  isSoldOut: boolean;
  status: "active" | "sold_out" | "removed";
  removedReason: string | null;
  removedAt: string | null;
  createdAt: string;
  thumbnailVideoId?: string;
}

export interface RegistryEntry {
  videoId: string;
  cid: string;
  title: string;
  creatorAddress: string;
  priceMist: string;
  durationMs: number;
  status: "active" | "sold_out" | "removed";
  isSoldOut: boolean;
  createdAt: string;
  thumbnailVideoId?: string;
}

export interface Registry {
  videos: RegistryEntry[];
  updatedAt: string;
}

export interface AccessRecord {
  accessId: string;
  videoId: string;
  videoCid: string;
  viewerEmail: string;
  viewerAddress: string;
  txDigest: string;
  paymentAmountMist: string;
  paymentAmountUsd: number;
  creatorAmountUsd: number;
  platformFeeUsd: number;
  accessExpiresAt: string;
  createdAt: string;
}

export interface PurchaseRecord {
  purchaseId: string;
  videoId: string;
  videoCid: string;
  buyerEmail: string;
  buyerAddress: string;
  creatorAddress: string;
  txDigest: string;
  paymentSymbol: string;
  paymentAmountMist: string;
  paymentAmountUsd: number;
  creatorAmountUsd: number;
  platformFeeUsd: number;
  createdAt: string;
}

// ─── Core Pinata Functions ────────────────────────────────────────────────────

/**
 * Upload JSON data to Pinata with a metadata name
 */
export async function uploadJsonToPinata(
  data: unknown,
  metadataName: string
): Promise<string> {
  const jwt = getPinataJwt();

  const body = {
    pinataContent: data,
    pinataMetadata: {
      name: metadataName,
    },
    pinataOptions: {
      cidVersion: 1,
    },
  };

  const res = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinata upload failed: ${err}`);
  }

  const result = await res.json();
  return result.IpfsHash as string;
}

/**
 * Fetch JSON from IPFS via Pinata gateway
 */
export async function getJsonFromCid<T = unknown>(cid: string): Promise<T> {
  const url = `${PINATA_GATEWAY}/ipfs/${cid}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Failed to fetch CID ${cid}: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Search Pinata for files by metadata name, returns most recent first
 */
export async function findLatestFileByMetadataName(
  name: string
): Promise<{ cid: string; createdAt: string } | null> {
  const jwt = getPinataJwt();

  const params = new URLSearchParams({
    metadata: JSON.stringify({ name }),
    status: "pinned",
    pageLimit: "10",
    pageOffset: "0",
  });

  const res = await fetch(`${PINATA_API_URL}/data/pinList?${params}`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pinata search failed: ${err}`);
  }

  const result = await res.json();
  const rows = result.rows as Array<{
    ipfs_pin_hash: string;
    date_pinned: string;
  }>;

  if (!rows || rows.length === 0) return null;

  // Sort by date_pinned descending
  rows.sort(
    (a, b) =>
      new Date(b.date_pinned).getTime() - new Date(a.date_pinned).getTime()
  );

  return { cid: rows[0].ipfs_pin_hash, createdAt: rows[0].date_pinned };
}

// ─── Registry Functions ───────────────────────────────────────────────────────

const REGISTRY_NAME = "private-tube-registry-latest";

/**
 * Get the latest video registry from Pinata
 */
export async function getLatestRegistry(): Promise<Registry> {
  const latest = await findLatestFileByMetadataName(REGISTRY_NAME);

  if (!latest) {
    return { videos: [], updatedAt: new Date().toISOString() };
  }

  try {
    return await getJsonFromCid<Registry>(latest.cid);
  } catch {
    return { videos: [], updatedAt: new Date().toISOString() };
  }
}

/**
 * Add or update a video entry in the registry and upload new version
 */
export async function updateVideoRegistry(
  newEntry: RegistryEntry
): Promise<string> {
  const registry = await getLatestRegistry();

  // Replace existing entry or append
  const idx = registry.videos.findIndex((v) => v.videoId === newEntry.videoId);
  if (idx >= 0) {
    registry.videos[idx] = newEntry;
  } else {
    registry.videos.push(newEntry);
  }

  registry.updatedAt = new Date().toISOString();

  const cid = await uploadJsonToPinata(registry, REGISTRY_NAME);
  return cid;
}

// ─── Video Metadata Functions ─────────────────────────────────────────────────

/**
 * Get video metadata by videoId (looks up CID from registry)
 */
export async function getVideoMetadata(
  videoId: string
): Promise<{ metadata: VideoMetadata; cid: string } | null> {
  const registry = await getLatestRegistry();
  const entry = registry.videos.find((v) => v.videoId === videoId);

  if (!entry) return null;

  try {
    const metadata = await getJsonFromCid<VideoMetadata>(entry.cid);
    return { metadata, cid: entry.cid };
  } catch {
    return null;
  }
}

/**
 * Update video metadata: upload new version and update registry
 */
export async function updateVideoMetadata(
  videoId: string,
  updatedData: Partial<VideoMetadata>
): Promise<string> {
  const existing = await getVideoMetadata(videoId);
  if (!existing) throw new Error(`Video ${videoId} not found in registry`);

  const updated: VideoMetadata = { ...existing.metadata, ...updatedData };

  // Upload new metadata version
  const newCid = await uploadJsonToPinata(
    updated,
    `video-metadata-${videoId}`
  );

  // Update registry with new CID
  const registry = await getLatestRegistry();
  const entry = registry.videos.find((v) => v.videoId === videoId);
  if (entry) {
    entry.cid = newCid;
    entry.status = updated.status;
    entry.isSoldOut = updated.isSoldOut;
  }

  await uploadJsonToPinata(registry, REGISTRY_NAME);

  return newCid;
}

// ─── Access Record Functions ──────────────────────────────────────────────────

/**
 * Create an access record on Pinata
 */
export async function createAccessRecord(
  accessData: AccessRecord
): Promise<string> {
  const name = `access-${accessData.viewerAddress}-${accessData.videoId}`;
  return uploadJsonToPinata(accessData, name);
}

/**
 * Find the most recent active access record for a viewer+video
 */
export async function findActiveAccess(
  viewerAddress: string,
  videoId: string
): Promise<AccessRecord | null> {
  const name = `access-${viewerAddress}-${videoId}`;
  const latest = await findLatestFileByMetadataName(name);

  if (!latest) return null;

  try {
    const record = await getJsonFromCid<AccessRecord>(latest.cid);
    const now = new Date();
    const expiry = new Date(record.accessExpiresAt);

    if (expiry > now) {
      return record;
    }
    return null; // expired
  } catch {
    return null;
  }
}

/**
 * Find any access record (including expired) for a viewer+video
 */
export async function findAnyAccess(
  viewerAddress: string,
  videoId: string
): Promise<AccessRecord | null> {
  const name = `access-${viewerAddress}-${videoId}`;
  const latest = await findLatestFileByMetadataName(name);

  if (!latest) return null;

  try {
    return await getJsonFromCid<AccessRecord>(latest.cid);
  } catch {
    return null;
  }
}

// ─── Purchase Record Functions ────────────────────────────────────────────────

/**
 * Create a purchase record on Pinata
 */
export async function createPurchaseRecord(
  purchaseData: PurchaseRecord
): Promise<string> {
  const name = `purchase-${purchaseData.videoId}-${purchaseData.txDigest}`;
  return uploadJsonToPinata(purchaseData, name);
}

/**
 * Check if a txDigest has already been processed
 */
export async function isPurchaseDuplicate(
  videoId: string,
  txDigest: string
): Promise<boolean> {
  const name = `purchase-${videoId}-${txDigest}`;
  const existing = await findLatestFileByMetadataName(name);
  return existing !== null;
}
