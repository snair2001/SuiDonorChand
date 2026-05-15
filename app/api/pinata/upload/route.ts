/**
 * POST /api/pinata/upload
 * Proxy endpoint for Pinata uploads (keeps JWT server-side)
 * Only accessible to authenticated users
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { uploadJsonToPinata } from "@/lib/pinata";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json();

      if (!body.data || !body.metadataName) {
        return NextResponse.json(
          { error: "data and metadataName are required" },
          { status: 400 }
        );
      }

      // Prevent uploading sensitive data through this endpoint
      if (
        body.data.encryptedUrl ||
        body.data.iv ||
        body.data.authTag
      ) {
        return NextResponse.json(
          { error: "Cannot upload encrypted video metadata through this endpoint" },
          { status: 403 }
        );
      }

      const cid = await uploadJsonToPinata(body.data, body.metadataName);

      return NextResponse.json({ cid });
    } catch (err) {
      console.error("Pinata upload error:", err);
      return NextResponse.json(
        { error: "Upload failed" },
        { status: 500 }
      );
    }
  });
}
