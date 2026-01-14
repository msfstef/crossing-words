import { useState, useEffect, useRef } from 'react';

/**
 * Hook to enforce a minimum display time for loading states.
 *
 * Behavior:
 * - If data is immediately available (isActuallyLoading starts false), show content immediately
 * - If loading is needed, show skeleton for at least minimumMs to prevent jarring flash
 * - Each transition from false→true→false is a fresh loading cycle
 *
 * @param isActuallyLoading - The real loading state from your data/async operation
 * @param minimumMs - Minimum time (in ms) to show loading state when loading occurs (default: 250ms)
 * @returns Whether to show loading state
 */
export function useMinimumLoadingTime(
  isActuallyLoading: boolean,
  minimumMs: number = 250
): boolean {
  const loadingStartRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const prevLoadingRef = useRef(isActuallyLoading);

  // Initialize based on current loading state
  const [showLoading, setShowLoading] = useState(() => {
    if (isActuallyLoading) {
      loadingStartRef.current = Date.now();
      return true;
    }
    return false;
  });

  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isActuallyLoading;

    if (isActuallyLoading) {
      // Loading started (or continuing)
      if (!wasLoading) {
        // Fresh loading cycle - record start time
        loadingStartRef.current = Date.now();
      }
      setShowLoading(true);

      // Clear any pending timeout from a previous cycle
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } else {
      // Loading finished
      if (!wasLoading) {
        // Was never loading - data was immediately available
        // Don't show skeleton at all
        setShowLoading(false);
        return;
      }

      // Was loading, now finished - check minimum time
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
