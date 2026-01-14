import { useState, useEffect, useRef } from 'react';

/**
 * Hook to enforce a minimum display time for loading states.
 *
 * Behavior:
 * - If data is immediately available (isActuallyLoading starts false), show content immediately
 * - If loading is needed, show skeleton for at least minimumMs to prevent jarring flash
 *
 * @param isActuallyLoading - The real loading state from your data/async operation
 * @param minimumMs - Minimum time (in ms) to show loading state when loading occurs (default: 250ms)
 * @returns Whether to show loading state
 */
export function useMinimumLoadingTime(
  isActuallyLoading: boolean,
  minimumMs: number = 250
): boolean {
  // Track if we've ever started loading - if not, data was cached
  const hasStartedLoadingRef = useRef(false);
  const loadingStartRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Only show loading if we've actually started loading
  // This prevents flash when data is immediately available from cache
  const [showLoading, setShowLoading] = useState(() => {
    if (isActuallyLoading) {
      hasStartedLoadingRef.current = true;
      loadingStartRef.current = Date.now();
      return true;
    }
    return false;
  });

  useEffect(() => {
    if (isActuallyLoading) {
      // Loading started - record the time and show loading state
      if (!hasStartedLoadingRef.current) {
        hasStartedLoadingRef.current = true;
        loadingStartRef.current = Date.now();
      }
      setShowLoading(true);

      // Clear any pending timeout from a previous loading cycle
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    } else {
      // Loading finished
      if (!hasStartedLoadingRef.current) {
        // Never started loading - data was cached, don't show skeleton
        setShowLoading(false);
        return;
      }

      // Check if minimum time has passed
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
