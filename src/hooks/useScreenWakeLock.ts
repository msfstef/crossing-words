/**
 * Hook for managing Screen Wake Lock API.
 *
 * Prevents the device from dimming or locking the screen while active.
 * Automatically re-acquires the lock when the page becomes visible again.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseScreenWakeLockOptions {
  /** Whether the wake lock should be active */
  enabled: boolean;
}

interface UseScreenWakeLockReturn {
  /** Whether the wake lock is currently active */
  isLocked: boolean;
  /** Whether the Screen Wake Lock API is supported */
  isSupported: boolean;
  /** Error message if wake lock acquisition failed */
  error: string | null;
}

/**
 * Hook to manage screen wake lock.
 *
 * When enabled, prevents the screen from dimming/sleeping.
 * Automatically handles visibility changes (re-acquires lock when page becomes visible).
 *
 * @example
 * ```typescript
 * const { isLocked, isSupported, error } = useScreenWakeLock({
 *   enabled: isFollowing,
 * });
 * ```
 */
/**
 * Check if Screen Wake Lock API is supported.
 * Must be called fresh each time to handle test mocking.
 */
function checkWakeLockSupport(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator && navigator.wakeLock !== undefined;
}

export function useScreenWakeLock({
  enabled,
}: UseScreenWakeLockOptions): UseScreenWakeLockReturn {
  const [isLocked, setIsLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Check if the API is supported (computed fresh to handle test mocking)
  const isSupported = checkWakeLockSupport();

  /**
   * Acquire the wake lock.
   */
  const acquireWakeLock = useCallback(async () => {
    if (!isSupported) {
      return;
    }

    try {
      // Release existing lock if any
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }

      // Request new wake lock
      const wakeLock = await navigator.wakeLock.request('screen');
      wakeLockRef.current = wakeLock;
      setIsLocked(true);
      setError(null);

      console.debug('[WakeLock] Acquired screen wake lock');

      // Handle release event (e.g., when page becomes hidden)
      wakeLock.addEventListener('release', () => {
        console.debug('[WakeLock] Wake lock released');
        setIsLocked(false);
        wakeLockRef.current = null;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to acquire wake lock';
      console.warn('[WakeLock] Failed to acquire:', message);
      setError(message);
      setIsLocked(false);
    }
  }, [isSupported]);

  /**
   * Release the wake lock.
   */
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        console.debug('[WakeLock] Released screen wake lock');
      } catch (err) {
        console.warn('[WakeLock] Error releasing:', err);
      }
      wakeLockRef.current = null;
      setIsLocked(false);
    }
  }, []);

  /**
   * Manage wake lock based on enabled state.
   */
  useEffect(() => {
    if (enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- acquireWakeLock is async and sets state on completion, which is the intended pattern for external API integration
      acquireWakeLock();
    } else {
      releaseWakeLock();
    }

    return () => {
      // Cleanup on unmount
      releaseWakeLock();
    };
  }, [enabled, acquireWakeLock, releaseWakeLock]);

  /**
   * Re-acquire wake lock when page becomes visible again.
   * The wake lock is automatically released when the page is hidden,
   * so we need to re-acquire it when coming back.
   */
  useEffect(() => {
    if (!enabled || !isSupported) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled && !wakeLockRef.current) {
        console.debug('[WakeLock] Page visible, re-acquiring wake lock');
        acquireWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, isSupported, acquireWakeLock]);

  return {
    isLocked,
    isSupported,
    error,
  };
}

