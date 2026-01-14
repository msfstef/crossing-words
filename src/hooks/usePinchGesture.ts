import { useRef, useCallback } from 'react';

interface PinchGestureOptions {
  onPinchIn?: () => void;
  onPinchOut?: () => void;
  threshold?: number; // scale change threshold to trigger action
  minDistance?: number; // minimum distance between fingers to be considered a pinch
}

interface TouchHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchCancel: (e: React.TouchEvent) => void;
}

function getDistance(touch1: React.Touch, touch2: React.Touch): number {
  const dx = touch2.clientX - touch1.clientX;
  const dy = touch2.clientY - touch1.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function usePinchGesture({
  onPinchIn,
  onPinchOut,
  threshold = 0.3,
  minDistance = 50,
}: PinchGestureOptions): TouchHandlers {
  const initialDistanceRef = useRef<number | null>(null);
  const isPinchingRef = useRef(false);
  const hasTriggeredRef = useRef(false);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        // Two finger touch detected - potential pinch gesture
        const distance = getDistance(e.touches[0], e.touches[1]);

        if (distance >= minDistance) {
          initialDistanceRef.current = distance;
          isPinchingRef.current = true;
          hasTriggeredRef.current = false;

          // Prevent browser zoom
          e.preventDefault();
        }
      }
    },
    [minDistance]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && isPinchingRef.current && initialDistanceRef.current) {
        const distance = getDistance(e.touches[0], e.touches[1]);
        const scale = distance / initialDistanceRef.current;

        // Only trigger once per pinch gesture
        if (!hasTriggeredRef.current) {
          if (scale < (1 - threshold)) {
            // Pinch in - fingers moving closer
            onPinchIn?.();
            hasTriggeredRef.current = true;
          } else if (scale > (1 + threshold)) {
            // Pinch out - fingers moving apart
            onPinchOut?.();
            hasTriggeredRef.current = true;
          }
        }

        // Prevent browser zoom during pinch
        e.preventDefault();
      }
    },
    [threshold, onPinchIn, onPinchOut]
  );

  const handleTouchEnd = useCallback(() => {
    // Reset pinch state
    initialDistanceRef.current = null;
    isPinchingRef.current = false;
    hasTriggeredRef.current = false;
  }, []);

  const handleTouchCancel = useCallback(() => {
    // Reset pinch state on cancel
    initialDistanceRef.current = null;
    isPinchingRef.current = false;
    hasTriggeredRef.current = false;
  }, []);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
  };
}
