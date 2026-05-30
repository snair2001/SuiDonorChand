/**
 * POST /api/payment/record
 * Records a payment, creates access, updates video revenue
 * SECURITY: All calculations done server-side
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { validatePaymentInput } from "@/lib/validation";
import { getVideoMetadata, updateVideoMetadata, createPurchaseRecord, isPurchaseDuplicate } from "@/lib/pinata";
import { grantAccess } from "@/lib/accessStore";
import { mistToUsd, calculateFees } from "@/lib/pricing";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    console.log("[payment/record] Starting payment recording", { userEmail: user.email, userAddress: user.suiAddress });
    try {
      const body = await req.json();
      console.log("[payment/record] Request body:", { videoId: body.videoId, txDigest: body.txDigest?.slice(0, 20) + "..." });

      // Validate input
      const validation = validatePaymentInput({
        videoId: body.videoId,
        txDigest: body.txDigest,
      });

      if (!validation.valid) {
        console.error("[payment/record] Validation failed:", validation.errors);
        return NextResponse.json(
          { error: "Validation failed", errors: validation.errors },
          { status: 400 }
        );
      }

      const { videoId, txDigest } = body;

      // Check for duplicate transaction — return existing access if found
      console.log("[payment/record] Checking for duplicate purchase...");
      const isDuplicate = await isPurchaseDuplicate(videoId, txDigest);
      console.log("[payment/record] Is duplicate?", isDuplicate);
      if (isDuplicate) {
        // Try to find the existing access record and return it
        const { findAnyAccess } = await import("@/lib/pinata");
        console.log("[payment/record] Finding existing access...");
        const existingAccess = await findAnyAccess(user.suiAddress, videoId, user.email);
        console.log("[payment/record] Existing access found?", !!existingAccess);
        
        // If no access record found, but purchase is duplicate, still grant access!
        if (!existingAccess) {
          console.log("[payment/record] Duplicate purchase but no access found—granting access now!");
          
          // Fetch video metadata again to grant access
          const result = await getVideoMetadata(videoId);
          if (!result) {
            return NextResponse.json({ error: "Video not found" }, { status: 404 });
          }
          const { metadata, cid: videoCid } = result;
          
          // Calculate payment amounts (server-side only)
          const paymentAmountMist = BigInt(metadata.priceMist);
          const paymentAmountUsd = await mistToUsd(paymentAmountMist);
          const platformFeePercentage = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || "10");
          const { platformFeeUsd, creatorAmountUsd } = calculateFees(paymentAmountUsd, platformFeePercentage);
          
          // Grant access now!
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
          });
        }
        
        return NextResponse.json(
          {
            error: "Transaction already processed",
            access: existingAccess
              ? {
                  hasAccess: new Date(existingAccess.accessExpiresAt) > new Date(),
                  expiresAt: existingAccess.accessExpiresAt,
                  videoId,
                }
              : null,
          },
          { status: 409 }
        );
      }

      // Fetch video metadata
      console.log("[payment/record] Fetching video metadata...");
      const result = await getVideoMetadata(videoId);
      if (!result) {
        console.error("[payment/record] Video not found");
        return NextResponse.json({ error: "Video not found" }, { status: 404 });
      }

      const { metadata, cid: videoCid } = result;
      console.log("[payment/record] Video metadata found:", { title: metadata.title, priceMist: metadata.priceMist });

      // Check video is active and not sold out
      if (metadata.status !== "active") {
        console.error("[payment/record] Video not active");
        return NextResponse.json(
          { error: "Video is not available for purchase" },
          { status: 400 }
        );
      }

      if (metadata.isSoldOut) {
        console.error("[payment/record] Video sold out");
        return NextResponse.json(
          { error: "Video has reached its revenue cap and is sold out" },
          { status: 400 }
        );
      }

      if (metadata.isDisabled) {
        console.error("[payment/record] Video disabled");
        return NextResponse.json(
          { error: "This campaign has been disabled by the platform admin" },
          { status: 403 }
        );
      }

      // Calculate payment amounts (server-side only)
      console.log("[payment/record] Calculating payment amounts...");
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
      console.log("[payment/record] Creating purchase record...");
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
      console.log("[payment/record] Purchase record created successfully");

      // Grant access to viewer
      console.log("[payment/record] Granting access...");
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
      console.log("[payment/record] Access granted! Expires at:", access.accessExpiresAt);

      // Update video revenue metadata
      console.log("[payment/record] Updating video metadata...");
      const newGrossRevenue =
        metadata.totalGrossRevenueUsd + paymentAmountUsd;
      const newCreatorRevenue =
        metadata.totalCreatorRevenueUsd + creatorAmountUsd;
      const newPlatformRevenue =
        metadata.totalPlatformRevenueUsd + platformFeeUsd;
      const newPurchaseCount = metadata.purchaseCount + 1;

      const revenueCapUsd = metadata.revenueCapUsd;
      const isSoldOut = newGrossRevenue >= revenueCapUsd;

      // Upload new video metadata version and update registry atomically
      // Pass existing metadata directly to avoid re-fetching from IPFS gateway
      // (prevents stale cache from corrupting encryptedUrl/iv/authTag fields)
      await updateVideoMetadata(videoId, {
        totalGrossRevenueUsd: newGrossRevenue,
        totalCreatorRevenueUsd: newCreatorRevenue,
        totalPlatformRevenueUsd: newPlatformRevenue,
        purchaseCount: newPurchaseCount,
        isSoldOut,
        status: isSoldOut ? ("sold_out" as const) : ("active" as const),
        removedReason: isSoldOut ? "Revenue cap reached" : null,
        removedAt: isSoldOut ? new Date().toISOString() : null,
      }, metadata);
      console.log("[payment/record] Video metadata updated!");

      console.log("[payment/record] All done! Success!");
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
      console.error("[payment/record] FATAL ERROR:", err);
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
