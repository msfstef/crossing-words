/**
 * Hook for managing screen orientation on mobile devices.
 *
 * Attempts to lock the screen orientation to portrait on phone-sized
 * devices while allowing tablets and desktops to use any orientation.
 *
 * This helps ensure the app respects user expectations on mobile devices
 * where landscape mode may not be ideal for the crossword UI.
 *
 * Note: The Screen Orientation API requires fullscreen mode on some browsers,
 * so this may not work in all contexts. The hook fails gracefully.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen_Orientation_API
 */

import { useEffect, useState } from 'react';

/** Threshold for considering a device as "phone-sized" (in CSS pixels) */
const PHONE_MAX_WIDTH = 768;

/**
 * Check if the current device appears to be a phone (not a tablet).
 * Uses screen dimensions and touch capability as heuristics.
 */
function isPhoneSizedDevice(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for touch capability (indicates mobile)
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!hasTouch) return false;

  // Get screen dimensions (actual device screen, not viewport)
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;

  // Consider it a phone if both dimensions are below tablet thresholds
  // Use the smaller dimension to handle both orientations
  const smallerDimension = Math.min(screenWidth, screenHeight);
  const largerDimension = Math.max(screenWidth, screenHeight);

  // Phone: smaller dimension < 768 and aspect ratio is tall (phone-like)
  const isPhoneSize = smallerDimension < PHONE_MAX_WIDTH;
  const isPhoneAspectRatio = largerDimension / smallerDimension > 1.4;

  return isPhoneSize && isPhoneAspectRatio;
}

interface UseOrientationLockReturn {
  /** Whether orientation lock is currently active */
  isLocked: boolean;
  /** Whether the device is detected as phone-sized */
  isPhoneDevice: boolean;
  /** Whether the Screen Orientation API is supported */
  isSupported: boolean;
}

/**
 * Hook to lock screen orientation to portrait on phone-sized devices.
 *
 * @example
 * ```typescript
 * const { isLocked, isPhoneDevice } = useOrientationLock();
 * // The hook handles orientation automatically
 * ```
 */
export function useOrientationLock(): UseOrientationLockReturn {
  const [isLocked, setIsLocked] = useState(false);
  const [isPhoneDevice] = useState(() => isPhoneSizedDevice());

  // Check if the API is supported
  const isSupported =
    typeof screen !== 'undefined' &&
    'orientation' in screen &&
    typeof screen.orientation?.lock === 'function';

  useEffect(() => {
    // Only attempt to lock on phone-sized devices
    if (!isPhoneDevice || !isSupported) {
      return;
    }

    let isMounted = true;

    const attemptLock = async () => {
      try {
        // Attempt to lock to portrait
        // Note: This may fail if not in fullscreen mode (browser requirement)
        await screen.orientation.lock('portrait-primary');
        if (isMounted) {
          setIsLocked(true);
          console.debug('[OrientationLock] Locked to portrait');
        }
      } catch (err) {
        // This is expected to fail in many contexts (not fullscreen, not PWA, etc.)
        // Just log for debugging and continue - the app works fine without the lock
        console.debug(
          '[OrientationLock] Could not lock orientation:',
          err instanceof Error ? err.message : err
        );
        if (isMounted) {
          setIsLocked(false);
        }
      }
    };

    attemptLock();

    return () => {
      isMounted = false;
      // Note: We don't unlock on unmount because:
      // 1. If this is the main app component, unmount means the app is closing
      // 2. Unlocking could cause jarring orientation changes during navigation
    };
  }, [isPhoneDevice, isSupported]);

  return {
    isLocked,
    isPhoneDevice,
    isSupported,
  };
}

// TypeScript declaration for Screen Orientation API (not fully in standard lib)
declare global {
  interface ScreenOrientation {
    lock(orientation: OrientationLockType): Promise<void>;
    unlock(): void;
  }

  type OrientationLockType =
    | 'any'
    | 'natural'
    | 'landscape'
    | 'portrait'
    | 'portrait-primary'
    | 'portrait-secondary'
    | 'landscape-primary'
    | 'landscape-secondary';
}
