/**
 * YouTube URL utilities
 * Validates and converts YouTube URLs to safe embed URLs
 * Never returns raw YouTube URLs to the frontend
 */

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractYouTubeId(url: string): string | null {
  if (!url || typeof url !== "string") return null;

  const trimmed = url.trim();

  // Pattern: youtu.be/VIDEO_ID
  const shortMatch = trimmed.match(
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&]|$)/
  );
  if (shortMatch) return shortMatch[1];

  // Pattern: youtube.com/watch?v=VIDEO_ID
  const watchMatch = trimmed.match(
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})(?:[?&]|$)/
  );
  if (watchMatch) return watchMatch[1];

  // Pattern: youtube.com/embed/VIDEO_ID
  const embedMatch = trimmed.match(
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})(?:[?&]|$)/
  );
  if (embedMatch) return embedMatch[1];

  // Pattern: youtube.com/v/VIDEO_ID
  const vMatch = trimmed.match(
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})(?:[?&]|$)/
  );
  if (vMatch) return vMatch[1];

  return null;
}

/**
 * Validate a YouTube video ID
 */
export function isValidYouTubeId(id: string): boolean {
  return YOUTUBE_ID_REGEX.test(id);
}

/**
 * Validate a YouTube URL and return the video ID
 */
export function validateYouTubeUrl(url: string): {
  valid: boolean;
  videoId?: string;
  error?: string;
} {
  const id = extractYouTubeId(url);

  if (!id) {
    return {
      valid: false,
      error:
        "Invalid YouTube URL. Supported formats: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID",
    };
  }

  if (!isValidYouTubeId(id)) {
    return { valid: false, error: "Invalid YouTube video ID format" };
  }

  return { valid: true, videoId: id };
}

/**
 * Convert a YouTube video ID to a safe embed URL
 * This is the ONLY URL format returned to the frontend
 */
export function toEmbedUrl(videoId: string): string {
  if (!isValidYouTubeId(videoId)) {
    throw new Error("Invalid YouTube video ID");
  }
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;
}

/**
 * Get thumbnail URL for a YouTube video (safe to expose)
 */
export function getThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
