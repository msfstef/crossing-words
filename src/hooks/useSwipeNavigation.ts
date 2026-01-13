import { useCallback, useRef } from 'react';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

interface SwipeState {
  startX: number;
  startY: number;
  startTime: number;
  isTracking: boolean;
}

interface UseSwipeNavigationOptions {
  /** Callback when a valid swipe is detected */
  onSwipe: (direction: SwipeDirection) => void;
  /** Whether swipe detection is enabled */
  enabled?: boolean;
  /** Minimum distance in pixels for a valid swipe (default: 50) */
  threshold?: number;
  /** Minimum velocity in px/ms for a valid swipe (default: 0.3) */
  velocityThreshold?: number;
  /** Maximum time in ms for a valid swipe (default: 300) */
  maxTime?: number;
}

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchCancel: () => void;
}

/**
 * Hook for detecting swipe gestures on touch devices.
 *
 * Returns event handlers to attach to a container element.
 * Only triggers on deliberate swipes (meets distance, velocity, and time thresholds).
 *
 * @example
 * ```tsx
 * const swipeHandlers = useSwipeNavigation({
 *   onSwipe: (direction) => console.log('Swiped:', direction),
 *   enabled: isTouchDevice,
 * });
 *
 * return <div {...swipeHandlers}>Content</div>;
 * ```
 */
export function useSwipeNavigation({
  onSwipe,
  enabled = true,
  threshold = 50,
  velocityThreshold = 0.3,
  maxTime = 300,
}: UseSwipeNavigationOptions): SwipeHandlers {
  const swipeStateRef = useRef<SwipeState>({
    startX: 0,
    startY: 0,
    startTime: 0,
    isTracking: false,
  });

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;

      // Only handle single-finger touch
      if (e.touches.length !== 1) {
        swipeStateRef.current.isTracking = false;
        return;
      }

      const touch = e.touches[0];
      swipeStateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        isTracking: true,
      };
    },
    [enabled]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !swipeStateRef.current.isTracking) return;

      // Cancel if multiple fingers
      if (e.touches.length !== 1) {
        swipeStateRef.current.isTracking = false;
        return;
      }

      const touch = e.touches[0];
      const deltaX = touch.clientX - swipeStateRef.current.startX;
      const deltaY = touch.clientY - swipeStateRef.current.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Once we detect significant movement, prevent page scrolling
      if (distance > threshold / 2) {
        e.preventDefault();
      }
    },
    [enabled, threshold]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !swipeStateRef.current.isTracking) return;

      const state = swipeStateRef.current;
      swipeStateRef.current.isTracking = false;

      // Need at least one changed touch
      if (e.changedTouches.length === 0) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;
      const deltaTime = Date.now() - state.startTime;

      // Check time constraint
      if (deltaTime > maxTime) return;

      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const velocity = distance / deltaTime;

      // Check distance and velocity thresholds
      if (distance < threshold || velocity < velocityThreshold) return;

      // Determine swipe direction based on dominant axis
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      let direction: SwipeDirection;
      if (absX > absY) {
        // Horizontal swipe
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        // Vertical swipe
        direction = deltaY > 0 ? 'down' : 'up';
      }

      onSwipe(direction);
    },
    [enabled, threshold, velocityThreshold, maxTime, onSwipe]
  );

  const handleTouchCancel = useCallback(() => {
    swipeStateRef.current.isTracking = false;
  }, []);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
  };
}
