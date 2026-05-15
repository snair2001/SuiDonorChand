/**
 * Input validation utilities
 */

import { validateYouTubeUrl } from "./youtube";

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface CreateVideoInput {
  title: string;
  description: string;
  youtubeUrl: string;
  priceSui: number;
  durationHours: number;
}

/**
 * Validate video creation input
 */
export function validateCreateVideoInput(
  input: Partial<CreateVideoInput>
): ValidationResult {
  const errors: Record<string, string> = {};

  // Title
  if (!input.title || typeof input.title !== "string") {
    errors.title = "Title is required";
  } else if (input.title.trim().length < 3) {
    errors.title = "Title must be at least 3 characters";
  } else if (input.title.trim().length > 100) {
    errors.title = "Title must be 100 characters or less";
  }

  // Description
  if (!input.description || typeof input.description !== "string") {
    errors.description = "Description is required";
  } else if (input.description.trim().length < 10) {
    errors.description = "Description must be at least 10 characters";
  } else if (input.description.trim().length > 1000) {
    errors.description = "Description must be 1000 characters or less";
  }

  // YouTube URL
  if (!input.youtubeUrl || typeof input.youtubeUrl !== "string") {
    errors.youtubeUrl = "YouTube URL is required";
  } else {
    const ytValidation = validateYouTubeUrl(input.youtubeUrl);
    if (!ytValidation.valid) {
      errors.youtubeUrl = ytValidation.error || "Invalid YouTube URL";
    }
  }

  // Price
  if (input.priceSui === undefined || input.priceSui === null) {
    errors.priceSui = "Price is required";
  } else if (typeof input.priceSui !== "number" || isNaN(input.priceSui)) {
    errors.priceSui = "Price must be a number";
  } else if (input.priceSui < 0.001) {
    errors.priceSui = "Price must be at least 0.001 SUI";
  } else if (input.priceSui > 10000) {
    errors.priceSui = "Price must be 10,000 SUI or less";
  }

  // Duration
  if (input.durationHours === undefined || input.durationHours === null) {
    errors.durationHours = "Duration is required";
  } else if (
    typeof input.durationHours !== "number" ||
    isNaN(input.durationHours)
  ) {
    errors.durationHours = "Duration must be a number";
  } else if (input.durationHours < 1) {
    errors.durationHours = "Duration must be at least 1 hour";
  } else if (input.durationHours > 8760) {
    errors.durationHours = "Duration must be 8760 hours (1 year) or less";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate payment record input
 */
export function validatePaymentInput(input: {
  videoId?: string;
  txDigest?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.videoId || typeof input.videoId !== "string") {
    errors.videoId = "Video ID is required";
  } else if (!/^[a-zA-Z0-9_-]+$/.test(input.videoId)) {
    errors.videoId = "Invalid video ID format";
  }

  if (!input.txDigest || typeof input.txDigest !== "string") {
    errors.txDigest = "Transaction digest is required";
  } else if (
    !/^[A-Za-z0-9+/=_-]+$/.test(input.txDigest) ||
    input.txDigest.length < 10
  ) {
    errors.txDigest = "Invalid transaction digest format";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string, maxLength = 1000): string {
  return input.trim().slice(0, maxLength);
}
