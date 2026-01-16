/**
 * Image processing utilities for avatar creation.
 *
 * Handles resizing, cropping, and compressing images to create
 * avatar files suitable for storage and P2P transmission.
 *
 * Two sizes are generated:
 * - Profile avatar (192x192): Higher quality for profile dialog display
 * - Thumbnail (64x64): Compact version for collaborator icons and P2P transmission
 */

/**
 * Thumbnail avatar dimensions (64x64 pixels).
 * Used for collaborator icons and P2P transmission.
 */
export const AVATAR_THUMBNAIL_SIZE = 64;

/**
 * Profile avatar dimensions (192x192 pixels).
 * Used for profile dialog display.
 */
export const AVATAR_PROFILE_SIZE = 192;

/**
 * JPEG quality for thumbnail compression (0.7 = 70%).
 */
export const AVATAR_THUMBNAIL_QUALITY = 0.7;

/**
 * JPEG quality for profile avatar compression (0.85 = 85%).
 */
export const AVATAR_PROFILE_QUALITY = 0.85;

/**
 * @deprecated Use AVATAR_THUMBNAIL_SIZE instead
 */
export const AVATAR_SIZE = AVATAR_THUMBNAIL_SIZE;

/**
 * @deprecated Use AVATAR_THUMBNAIL_QUALITY instead
 */
export const AVATAR_QUALITY = AVATAR_THUMBNAIL_QUALITY;

/**
 * Maximum source file size to process (5MB).
 */
const MAX_SOURCE_SIZE = 5 * 1024 * 1024;

/**
 * Process an image file into a square avatar.
 * - Center-crops to square
 * - Resizes to AVATAR_SIZE x AVATAR_SIZE
 * - Compresses as JPEG
 *
 * @param source - File or Blob to process
 * @param size - Target size in pixels (default: AVATAR_SIZE)
 * @returns Base64 data URL of processed avatar
 * @throws Error if file is too large or invalid
 */
export async function processAvatarImage(
  source: File | Blob,
  size: number = AVATAR_SIZE
): Promise<string> {
  // Check file size
  if (source.size > MAX_SOURCE_SIZE) {
    throw new Error(`Image too large (max ${MAX_SOURCE_SIZE / 1024 / 1024}MB)`);
  }

  // Load image
  const imageBitmap = await createImageBitmap(source);

  // Calculate crop dimensions for center square
  const minDimension = Math.min(imageBitmap.width, imageBitmap.height);
  const cropX = (imageBitmap.width - minDimension) / 2;
  const cropY = (imageBitmap.height - minDimension) / 2;

  // Create canvas at target size
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Draw cropped and resized image
  ctx.drawImage(
    imageBitmap,
    cropX, // Source X
    cropY, // Source Y
    minDimension, // Source width
    minDimension, // Source height
    0, // Dest X
    0, // Dest Y
    size, // Dest width
    size // Dest height
  );

  // Clean up
  imageBitmap.close();

  // Export as JPEG data URL
  const dataUrl = canvas.toDataURL('image/jpeg', AVATAR_QUALITY);

  // Verify the result isn't too large (should be ~2-5KB)
  const base64Length = dataUrl.length - 'data:image/jpeg;base64,'.length;
  const approximateBytes = (base64Length * 3) / 4;
  console.debug(
    `[imageUtils] Processed avatar: ${size}x${size}px, ~${Math.round(approximateBytes / 1024)}KB`
  );

  return dataUrl;
}

/**
 * Result of processing an avatar image into multiple sizes.
 */
export interface ProcessedAvatarImages {
  /** High-quality profile avatar (192x192, 85% quality) */
  profile: string;
  /** Compact thumbnail for icons and P2P (64x64, 70% quality) */
  thumbnail: string;
}

/**
 * Process an image file into both profile and thumbnail avatars.
 * - Center-crops to square
 * - Generates high-quality profile version (192x192)
 * - Generates compact thumbnail version (64x64)
 *
 * @param source - File or Blob to process
 * @returns Object with profile and thumbnail data URLs
 * @throws Error if file is too large or invalid
 */
export async function processAvatarImages(
  source: File | Blob
): Promise<ProcessedAvatarImages> {
  // Check file size
  if (source.size > MAX_SOURCE_SIZE) {
    throw new Error(`Image too large (max ${MAX_SOURCE_SIZE / 1024 / 1024}MB)`);
  }

  // Load image
  const imageBitmap = await createImageBitmap(source);

  // Calculate crop dimensions for center square
  const minDimension = Math.min(imageBitmap.width, imageBitmap.height);
  const cropX = (imageBitmap.width - minDimension) / 2;
  const cropY = (imageBitmap.height - minDimension) / 2;

  // Helper to create avatar at specific size and quality
  const createAvatar = (size: number, quality: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.drawImage(
      imageBitmap,
      cropX,
      cropY,
      minDimension,
      minDimension,
      0,
      0,
      size,
      size
    );

    return canvas.toDataURL('image/jpeg', quality);
  };

  // Generate both sizes
  const profile = createAvatar(AVATAR_PROFILE_SIZE, AVATAR_PROFILE_QUALITY);
  const thumbnail = createAvatar(AVATAR_THUMBNAIL_SIZE, AVATAR_THUMBNAIL_QUALITY);

  // Clean up
  imageBitmap.close();

  // Debug logging
  const profileBytes = (profile.length - 'data:image/jpeg;base64,'.length) * 3 / 4;
  const thumbnailBytes = (thumbnail.length - 'data:image/jpeg;base64,'.length) * 3 / 4;
  console.debug(
    `[imageUtils] Processed avatars: profile ${AVATAR_PROFILE_SIZE}x${AVATAR_PROFILE_SIZE}px ~${Math.round(profileBytes / 1024)}KB, ` +
    `thumbnail ${AVATAR_THUMBNAIL_SIZE}x${AVATAR_THUMBNAIL_SIZE}px ~${Math.round(thumbnailBytes / 1024)}KB`
  );

  return { profile, thumbnail };
}

/**
 * Capture a frame from a video element as an avatar.
 * Used for camera capture functionality.
 *
 * @param video - HTMLVideoElement with active stream
 * @param size - Target size in pixels (default: AVATAR_SIZE)
 * @returns Base64 data URL of captured avatar
 */
export function captureVideoFrame(
  video: HTMLVideoElement,
  size: number = AVATAR_SIZE
): string {
  // Calculate crop for center square
  const minDimension = Math.min(video.videoWidth, video.videoHeight);
  const cropX = (video.videoWidth - minDimension) / 2;
  const cropY = (video.videoHeight - minDimension) / 2;

  // Create canvas at target size
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Draw cropped and resized frame
  ctx.drawImage(
    video,
    cropX,
    cropY,
    minDimension,
    minDimension,
    0,
    0,
    size,
    size
  );

  // Export as JPEG data URL
  return canvas.toDataURL('image/jpeg', AVATAR_QUALITY);
}

/**
 * Capture a frame from a video element as both profile and thumbnail avatars.
 * Used for camera capture functionality.
 *
 * @param video - HTMLVideoElement with active stream
 * @returns Object with profile and thumbnail data URLs
 */
export function captureVideoFrames(video: HTMLVideoElement): ProcessedAvatarImages {
  // Calculate crop for center square
  const minDimension = Math.min(video.videoWidth, video.videoHeight);
  const cropX = (video.videoWidth - minDimension) / 2;
  const cropY = (video.videoHeight - minDimension) / 2;

  // Helper to create avatar at specific size and quality
  const createAvatar = (size: number, quality: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    ctx.drawImage(
      video,
      cropX,
      cropY,
      minDimension,
      minDimension,
      0,
      0,
      size,
      size
    );

    return canvas.toDataURL('image/jpeg', quality);
  };

  return {
    profile: createAvatar(AVATAR_PROFILE_SIZE, AVATAR_PROFILE_QUALITY),
    thumbnail: createAvatar(AVATAR_THUMBNAIL_SIZE, AVATAR_THUMBNAIL_QUALITY),
  };
}

/**
 * Check if camera access is available.
 */
export function isCameraAvailable(): boolean {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/**
 * Start camera stream for avatar capture.
 *
 * @returns MediaStream for video preview
 */
export async function startCameraStream(): Promise<MediaStream> {
  if (!isCameraAvailable()) {
    throw new Error('Camera not available');
  }

  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user', // Front camera preferred
      width: { ideal: 640 },
      height: { ideal: 640 },
    },
    audio: false,
  });
}

/**
 * Stop a camera stream.
 */
export function stopCameraStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}
