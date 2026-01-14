import { useState, useEffect, useRef } from 'react';

/**
 * Hook to enforce a minimum display time for loading states.
 * Prevents jarring "flash" when content loads very quickly by ensuring
 * the loading state is shown for at least the specified minimum duration.
 *
 * @param isActuallyLoading - The real loading state from your data/async operation
 * @param minimumMs - Minimum time (in ms) to show loading state (default: 300ms)
 * @returns Whether to show loading state (considers minimum time)
 */
export function useMinimumLoadingTime(
  isActuallyLoading: boolean,
  minimumMs: number = 300
): boolean {
  const [showLoading, setShowLoading] = useState(isActuallyLoading);
  const loadingStartRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (isActuallyLoading) {
      // Loading started - record the time and show loading state
      loadingStartRef.current = Date.now();
      setShowLoading(true);

      // Clear any pending timeout from a previous loading cycle
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } else {
      // Loading finished - check if minimum time has passed
      if (loadingStartRef.current !== null) {
        const elapsed = Date.now() - loadingStartRef.current;
        const remaining = minimumMs - elapsed;

        if (remaining > 0) {
          // Haven't shown loading for minimum time yet - delay hiding
          timeoutRef.current = window.setTimeout(() => {
            setShowLoading(false);
            loadingStartRef.current = null;
            timeoutRef.current = null;
          }, remaining);
        } else {
          // Minimum time already passed - hide immediately
          setShowLoading(false);
          loadingStartRef.current = null;
        }
      } else {
        // No loading start recorded (initial state) - sync with actual state
        setShowLoading(false);
      }
    }

    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isActuallyLoading, minimumMs]);

  return showLoading;
}
