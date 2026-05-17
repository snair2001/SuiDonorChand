/**
 * POST /api/payment/record
 * Records a payment, creates access, updates video revenue
 * SECURITY: All calculations done server-side
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { validatePaymentInput } from "@/lib/validation";
import { getVideoMetadata, updateVideoMetadata, uploadJsonToPinata, updateVideoRegistry } from "@/lib/pinata";
import { createPurchaseRecord, isPurchaseDuplicate } from "@/lib/pinata";
import { grantAccess } from "@/lib/accessStore";
import { mistToUsd, calculateFees } from "@/lib/pricing";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();

      // Validate input
      const validation = validatePaymentInput({
        videoId: body.videoId,
        txDigest: body.txDigest,
      });

      if (!validation.valid) {
        return NextResponse.json(
          { error: "Validation failed", errors: validation.errors },
          { status: 400 }
        );
      }

      const { videoId, txDigest } = body;

      // Check for duplicate transaction
      const isDuplicate = await isPurchaseDuplicate(videoId, txDigest);
      if (isDuplicate) {
        return NextResponse.json(
          { error: "Transaction already processed" },
          { status: 409 }
        );
      }

      // Fetch video metadata
      const result = await getVideoMetadata(videoId);
      if (!result) {
        return NextResponse.json({ error: "Video not found" }, { status: 404 });
      }

      const { metadata, cid: videoCid } = result;

      // Check video is active and not sold out
      if (metadata.status !== "active") {
        return NextResponse.json(
          { error: "Video is not available for purchase" },
          { status: 400 }
        );
      }

      if (metadata.isSoldOut) {
        return NextResponse.json(
          { error: "Video has reached its revenue cap and is sold out" },
          { status: 400 }
        );
      }

      if (metadata.isDisabled) {
        return NextResponse.json(
          { error: "This campaign has been disabled by the platform admin" },
          { status: 403 }
        );
      }

      // Calculate payment amounts (server-side only)
      const paymentAmountMist = BigInt(metadata.priceMist);
      const paymentAmountUsd = await mistToUsd(paymentAmountMist);

      const platformFeePercentage = parseFloat(
        process.env.PLATFORM_FEE_PERCENTAGE || "10"
      );
      const { platformFeeUsd, creatorAmountUsd } = calculateFees(
        paymentAmountUsd,
        platformFeePercentage
      );

      // Create purchase record on Pinata
      const purchaseId = uuidv4();
      await createPurchaseRecord({
        purchaseId,
        videoId,
        videoCid,
        buyerEmail: user.email,
        buyerAddress: user.suiAddress,
        creatorAddress: metadata.creatorAddress,
        txDigest,
        paymentSymbol: "SUI",
        paymentAmountMist: paymentAmountMist.toString(),
        paymentAmountUsd,
        creatorAmountUsd,
        platformFeeUsd,
        createdAt: new Date().toISOString(),
      });

      // Grant access to viewer
      const access = await grantAccess({
        videoId,
        videoCid,
        viewerEmail: user.email,
        viewerAddress: user.suiAddress,
        txDigest,
        paymentAmountMist: paymentAmountMist.toString(),
        paymentAmountUsd,
        creatorAmountUsd,
        platformFeeUsd,
        durationMs: metadata.durationMs,
      });

      // Update video revenue metadata
      const newGrossRevenue =
        metadata.totalGrossRevenueUsd + paymentAmountUsd;
      const newCreatorRevenue =
        metadata.totalCreatorRevenueUsd + creatorAmountUsd;
      const newPlatformRevenue =
        metadata.totalPlatformRevenueUsd + platformFeeUsd;
      const newPurchaseCount = metadata.purchaseCount + 1;

      const revenueCapUsd = metadata.revenueCapUsd;
      const isSoldOut = newGrossRevenue >= revenueCapUsd;

      const updatedMetadata = {
        totalGrossRevenueUsd: newGrossRevenue,
        totalCreatorRevenueUsd: newCreatorRevenue,
        totalPlatformRevenueUsd: newPlatformRevenue,
        purchaseCount: newPurchaseCount,
        isSoldOut,
        status: isSoldOut
          ? ("sold_out" as const)
          : ("active" as const),
        removedReason: isSoldOut ? "Revenue cap reached" : null,
        removedAt: isSoldOut ? new Date().toISOString() : null,
      };

      // Upload new video metadata version
      const updatedVideo = { ...metadata, ...updatedMetadata };
      const newCid = await uploadJsonToPinata(
        updatedVideo,
        `video-metadata-${videoId}`
      );

      // Update registry with new CID and status
      const registry = await import("@/lib/pinata").then((m) =>
        m.getLatestRegistry()
      );
      const entry = registry.videos.find((v) => v.videoId === videoId);
      if (entry) {
        entry.cid = newCid;
        entry.status = updatedMetadata.status;
        entry.isSoldOut = updatedMetadata.isSoldOut;
        await uploadJsonToPinata(registry, "private-tube-registry-latest");
      }

      return NextResponse.json({
        success: true,
        access: {
          hasAccess: true,
          expiresAt: access.accessExpiresAt,
          videoId,
        },
        payment: {
          paymentAmountUsd,
          creatorAmountUsd,
          platformFeeUsd,
          txDigest,
        },
        videoStatus: {
          isSoldOut,
          totalGrossRevenueUsd: newGrossRevenue,
          revenueCapUsd,
        },
      });
    } catch (err) {
      console.error("Payment record error:", err);
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Failed to record payment",
        },
        { status: 500 }
      );
    }
  });
}
