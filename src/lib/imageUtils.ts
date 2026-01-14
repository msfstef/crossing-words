/**
 * Image processing utilities for avatar creation.
 *
 * Handles resizing, cropping, and compressing images to create
 * small avatar files suitable for storage and P2P transmission.
 */

/**
 * Default avatar dimensions (64x64 pixels).
 */
export const AVATAR_SIZE = 64;

/**
 * JPEG quality for avatar compression (0.7 = 70%).
 */
export const AVATAR_QUALITY = 0.7;

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
