/**
 * POST /api/videos/create
 * Creates a new encrypted video listing on Pinata IPFS
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { validateCreateVideoInput } from "@/lib/validation";
import { createVideo } from "@/lib/videoRegistry";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();

      const input = {
        title: body.title,
        description: body.description,
        youtubeUrl: body.youtubeUrl,
        priceSui: parseFloat(body.priceSui),
        durationHours: parseFloat(body.durationHours),
      };

      // Validate input
      const validation = validateCreateVideoInput(input);
      if (!validation.valid) {
        return NextResponse.json(
          { error: "Validation failed", errors: validation.errors },
          { status: 400 }
        );
      }

      // Create video with encrypted metadata
      const video = await createVideo({
        ...input,
        creatorEmail: user.email,
        creatorAddress: user.suiAddress,
      });

      return NextResponse.json({
        success: true,
        video,
      });
    } catch (err) {
      console.error("Create video error:", err);
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Failed to create video",
        },
        { status: 500 }
      );
    }
  });
}
