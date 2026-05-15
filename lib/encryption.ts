/**
 * AES-256-GCM encryption utilities
 * Server-side only — never import in client components
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getMasterKey(): Buffer {
  const key = process.env.ENCRYPTION_MASTER_KEY;
  if (!key) throw new Error("ENCRYPTION_MASTER_KEY is not set");

  // Accept hex-encoded 32-byte key
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error(
      "ENCRYPTION_MASTER_KEY must be a 32-byte hex string (64 hex chars)"
    );
  }
  return buf;
}

export interface EncryptedData {
  encryptedText: string; // base64
  iv: string; // base64
  authTag: string; // base64
}

export function encryptText(plainText: string): EncryptedData {
  const key = getMasterKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  return {
    encryptedText: encrypted,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptText(
  encryptedText: string,
  iv: string,
  authTag: string
): string {
  const key = getMasterKey();
  const ivBuf = Buffer.from(iv, "base64");
  const authTagBuf = Buffer.from(authTag, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, ivBuf);
  decipher.setAuthTag(authTagBuf);

  let decrypted = decipher.update(encryptedText, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
