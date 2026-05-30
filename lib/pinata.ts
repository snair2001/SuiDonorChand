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
  isDisabled: boolean;
  disabledReason: string | null;
  disabledAt: string | null;
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
  creatorEmail: string;
  creatorAddress: string;
  priceMist: string;
  durationMs: number;
  status: "active" | "sold_out" | "removed";
  isSoldOut: boolean;
  isDisabled: boolean;
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
  console.log("[pinata/findLatestFileByMetadataName] Searching for:", name);
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
    console.error("[pinata/findLatestFileByMetadataName] Pinata search failed:", err);
    throw new Error(`Pinata search failed: ${err}`);
  }

  const result = await res.json();
  const rows = result.rows as Array<{
    ipfs_pin_hash: string;
    date_pinned: string;
  }>;

  console.log("[pinata/findLatestFileByMetadataName] Found rows:", rows?.length);

  if (!rows || rows.length === 0) return null;

  // Sort by date_pinned descending
  rows.sort(
    (a, b) =>
      new Date(b.date_pinned).getTime() - new Date(a.date_pinned).getTime()
  );

  const found = { cid: rows[0].ipfs_pin_hash, createdAt: rows[0].date_pinned };
  console.log("[pinata/findLatestFileByMetadataName] Found latest:", found);
  return found;
}

// ─── Registry Functions ───────────────────────────────────────────────────────

const REGISTRY_NAME = "private-tube-registry-latest";

/**
 * Get the latest video registry from Pinata
 * Always returns a valid Registry object with a videos array.
 */
export async function getLatestRegistry(): Promise<Registry> {
  const emptyRegistry: Registry = { videos: [], updatedAt: new Date().toISOString() };

  try {
    const latest = await findLatestFileByMetadataName(REGISTRY_NAME);
    if (!latest) return emptyRegistry;

    const data = await getJsonFromCid<unknown>(latest.cid);

    // Defensive: ensure the fetched data has a valid videos array
    if (!data || typeof data !== "object") return emptyRegistry;
    const raw = data as Record<string, unknown>;
    if (!Array.isArray(raw.videos)) return emptyRegistry;

    return {
      videos: raw.videos as RegistryEntry[],
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    };
  } catch {
    return emptyRegistry;
  }
}

/**
 * Add or update a video entry in the registry and upload new version
 */
export async function updateVideoRegistry(
  newEntry: RegistryEntry
): Promise<string> {
  const registry = await getLatestRegistry();

  // Ensure videos array exists (defensive)
  if (!Array.isArray(registry.videos)) {
    registry.videos = [];
  }

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
  const videos = Array.isArray(registry.videos) ? registry.videos : [];
  const entry = videos.find((v) => v.videoId === videoId);

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
 * Optionally accepts existing metadata to avoid re-fetching from IPFS gateway
 * (prevents stale gateway cache from corrupting encryption fields)
 */
export async function updateVideoMetadata(
  videoId: string,
  updatedData: Partial<VideoMetadata>,
  existingMetadata?: VideoMetadata
): Promise<string> {
  let base: VideoMetadata;

  if (existingMetadata) {
    base = existingMetadata;
  } else {
    const existing = await getVideoMetadata(videoId);
    if (!existing) throw new Error(`Video ${videoId} not found in registry`);
    base = existing.metadata;
  }

  const updated: VideoMetadata = { ...base, ...updatedData };

  // Upload new metadata version
  const newCid = await uploadJsonToPinata(
    updated,
    `video-metadata-${videoId}`
  );

  // Update registry with new CID
  const registry = await getLatestRegistry();
  const videos = Array.isArray(registry.videos) ? registry.videos : [];
  const entry = videos.find((v) => v.videoId === videoId);
  if (entry) {
    entry.cid = newCid;
    entry.status = updated.status;
    entry.isSoldOut = updated.isSoldOut;
  }

  await uploadJsonToPinata({ ...registry, videos }, REGISTRY_NAME);

  return newCid;
}

// ─── Access Record Functions ──────────────────────────────────────────────────

/**
 * Create an access record on Pinata
 * Named by email+videoId so it works regardless of which wallet address was used
 */
export async function createAccessRecord(
  accessData: AccessRecord
): Promise<string> {
  console.log("[pinata/createAccessRecord] Starting with data:", {
    videoId: accessData.videoId,
    viewerEmail: accessData.viewerEmail,
    viewerAddress: accessData.viewerAddress
  });
  
  // Store by BOTH email and address for maximum lookup compatibility
  const nameByEmail = `access-email-${accessData.viewerEmail.replace(/[@.]/g, "_")}-${accessData.videoId}`;
  const nameByAddr = `access-${accessData.viewerAddress}-${accessData.videoId}`;
  
  console.log("[pinata/createAccessRecord] Generated names:", { nameByEmail, nameByAddr });

  // Upload once, pin under both names
  console.log("[pinata/createAccessRecord] Uploading by email name...");
  const cid = await uploadJsonToPinata(accessData, nameByEmail);
  console.log("[pinata/createAccessRecord] Uploaded by email! CID:", cid);

  // Also upload under address-based name for backward compat
  console.log("[pinata/createAccessRecord] Uploading by address name...");
  await uploadJsonToPinata(accessData, nameByAddr);
  console.log("[pinata/createAccessRecord] All uploads complete!");

  return cid;
}

/**
 * Find the most recent active access record for a viewer+video
 * Tries by address first, then by email as fallback
 */
export async function findActiveAccess(
  viewerAddress: string,
  videoId: string,
  viewerEmail?: string
): Promise<AccessRecord | null> {
  console.log("[pinata/findActiveAccess] Checking:", { viewerAddress, videoId, viewerEmail });
  const addrKey = `access-${viewerAddress}-${videoId}`;
  const emailKey = viewerEmail
    ? `access-email-${viewerEmail.replace(/[@.]/g, "_")}-${videoId}`
    : null;

  const latest =
    (await findLatestFileByMetadataName(addrKey)) ??
    (emailKey ? await findLatestFileByMetadataName(emailKey) : null);

  if (!latest) {
    console.log("[pinata/findActiveAccess] No access record found");
    return null;
  }

  try {
    const record = await getJsonFromCid<AccessRecord>(latest.cid);
    console.log("[pinata/findActiveAccess] Found record, checking expiry...", record.accessExpiresAt);
    const now = new Date();
    const expiry = new Date(record.accessExpiresAt);

    if (expiry > now) {
      console.log("[pinata/findActiveAccess] Access is active!");
      return record;
    }
    console.log("[pinata/findActiveAccess] Access expired");
    return null; // expired
  } catch (e) {
    console.error("[pinata/findActiveAccess] Error fetching record:", e);
    return null;
  }
}

/**
 * Find any access record (including expired) for a viewer+video
 * Tries by address first, then by email as fallback
 */
export async function findAnyAccess(
  viewerAddress: string,
  videoId: string,
  viewerEmail?: string
): Promise<AccessRecord | null> {
  console.log("[pinata/findAnyAccess] Checking:", { viewerAddress, videoId, viewerEmail });
  const addrKey = `access-${viewerAddress}-${videoId}`;
  const emailKey = viewerEmail
    ? `access-email-${viewerEmail.replace(/[@.]/g, "_")}-${videoId}`
    : null;

  const latest =
    (await findLatestFileByMetadataName(addrKey)) ??
    (emailKey ? await findLatestFileByMetadataName(emailKey) : null);

  if (!latest) {
    console.log("[pinata/findAnyAccess] No access record found");
    return null;
  }

  try {
    const record = await getJsonFromCid<AccessRecord>(latest.cid);
    console.log("[pinata/findAnyAccess] Found record:", record);
    return record;
  } catch (e) {
    console.error("[pinata/findAnyAccess] Error fetching record:", e);
    return null;
  }
}

/**
 * Find ANY video by creator email (any status — active, sold_out, removed, disabled)
 * Used to enforce one-video-per-account rule.
 */
export async function getAnyVideoByCreatorEmail(
  creatorEmail: string
): Promise<RegistryEntry | null> {
  const registry = await getLatestRegistry();
  const videos = Array.isArray(registry.videos) ? registry.videos : [];
  return (
    videos.find(
      (v) => v.creatorEmail?.toLowerCase() === creatorEmail.toLowerCase()
    ) ?? null
  );
}

/**
 * Find any active (non-disabled, non-sold-out) video by creator email
 * Used to enforce one-campaign-per-email rule
 */
export async function getActiveVideoByCreatorEmail(
  creatorEmail: string
): Promise<RegistryEntry | null> {
  const registry = await getLatestRegistry();
  const videos = Array.isArray(registry.videos) ? registry.videos : [];
  return (
    videos.find(
      (v) =>
        v.creatorEmail?.toLowerCase() === creatorEmail.toLowerCase() &&
        v.status === "active" &&
        !v.isSoldOut &&
        !v.isDisabled
    ) ?? null
  );
}

// ─── Purchase Record Functions ────────────────────────────────────────────────

/**
 * Create a purchase record on Pinata
 */
export async function createPurchaseRecord(
  purchaseData: PurchaseRecord
): Promise<string> {
  const name = `purchase-${purchaseData.videoId}-${purchaseData.txDigest}`;
  console.log("[pinata/createPurchaseRecord] Creating purchase record with name:", name);
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
  console.log("[pinata/isPurchaseDuplicate] Checking for:", name);
  const existing = await findLatestFileByMetadataName(name);
  const isDupe = existing !== null;
  console.log("[pinata/isPurchaseDuplicate] Is duplicate?", isDupe);
  return isDupe;
}
