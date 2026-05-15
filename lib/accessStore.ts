/**
 * Access store — wraps Pinata access record functions
 * Provides a clean interface for checking and creating access
 */

import {
  findActiveAccess,
  findAnyAccess,
  createAccessRecord,
  AccessRecord,
} from "./pinata";

export interface AccessStatus {
  hasAccess: boolean;
  expiresAt: string | null;
  isExpired: boolean;
  accessRecord: AccessRecord | null;
}

/**
 * Check if a viewer has active access to a video
 */
export async function checkAccess(
  viewerAddress: string,
  videoId: string
): Promise<AccessStatus> {
  const anyRecord = await findAnyAccess(viewerAddress, videoId);

  if (!anyRecord) {
    return {
      hasAccess: false,
      expiresAt: null,
      isExpired: false,
      accessRecord: null,
    };
  }

  const now = new Date();
  const expiry = new Date(anyRecord.accessExpiresAt);
  const isExpired = expiry <= now;

  return {
    hasAccess: !isExpired,
    expiresAt: anyRecord.accessExpiresAt,
    isExpired,
    accessRecord: anyRecord,
  };
}

/**
 * Grant access to a video for a viewer
 */
export async function grantAccess(params: {
  videoId: string;
  videoCid: string;
  viewerEmail: string;
  viewerAddress: string;
  txDigest: string;
  paymentAmountMist: string;
  paymentAmountUsd: number;
  creatorAmountUsd: number;
  platformFeeUsd: number;
  durationMs: number;
}): Promise<AccessRecord> {
  const { v4: uuidv4 } = await import("uuid");

  const now = new Date();
  const expiresAt = new Date(now.getTime() + params.durationMs);

  const accessRecord: AccessRecord = {
    accessId: uuidv4(),
    videoId: params.videoId,
    videoCid: params.videoCid,
    viewerEmail: params.viewerEmail,
    viewerAddress: params.viewerAddress,
    txDigest: params.txDigest,
    paymentAmountMist: params.paymentAmountMist,
    paymentAmountUsd: params.paymentAmountUsd,
    creatorAmountUsd: params.creatorAmountUsd,
    platformFeeUsd: params.platformFeeUsd,
    accessExpiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  };

  await createAccessRecord(accessRecord);
  return accessRecord;
}

export { findActiveAccess };
