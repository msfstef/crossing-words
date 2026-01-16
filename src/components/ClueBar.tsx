import { useRef, useLayoutEffect, useState } from 'react';
import { useSwipeNavigation, type SwipeDirection } from '../hooks/useSwipeNavigation';
import './ClueBar.css';

interface ClueBarProps {
  clue: {
    number: number;
    direction: 'across' | 'down';
    text: string;
  } | null;
  /** Navigate to previous clue */
  onPrevClue?: () => void;
  /** Navigate to next clue */
  onNextClue?: () => void;
  /** Whether there is a previous clue to navigate to */
  hasPrev?: boolean;
  /** Whether there is a next clue to navigate to */
  hasNext?: boolean;
  /** Toggle direction between across and down */
  onToggleDirection?: () => void;
  /** Callback for swipe navigation (mobile only) */
  onSwipe?: (direction: SwipeDirection) => void;
  /** Whether the device supports touch */
  isTouchDevice?: boolean;
}

// Font sizes in rem, from largest to smallest
// 0.9375rem (15px), 0.875rem (14px), 0.8125rem (13px), 0.75rem (12px), 0.6875rem (11px), 0.625rem (10px)
const FONT_SIZES = ['0.9375rem', '0.875rem', '0.8125rem', '0.75rem', '0.6875rem', '0.625rem'];
const DEFAULT_FONT_SIZE = FONT_SIZES[0];
const MIN_FONT_SIZE = FONT_SIZES[FONT_SIZES.length - 1];

/**
 * ClueBar displays the current clue with prev/next navigation buttons
 */
export function ClueBar({
  clue,
  onPrevClue,
  onNextClue,
  hasPrev = false,
  hasNext = false,
  onToggleDirection,
  onSwipe,
  isTouchDevice = false,
}: ClueBarProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const prevClueTextRef = useRef<string | null>(null);
  const [fontSize, setFontSize] = useState<string>(DEFAULT_FONT_SIZE);

  // Swipe navigation handlers (only active on touch devices)
  const swipeHandlers = useSwipeNavigation({
    onSwipe: onSwipe ?? (() => {}),
    enabled: isTouchDevice && Boolean(onSwipe),
  });

  // Measure text and shrink font progressively until it fits in 2 lines
  // Use useLayoutEffect to measure and set size BEFORE paint (prevents flicker)
  useLayoutEffect(() => {
    if (!clue || !textRef.current) return;

    // Create a stable clue identifier based on content, not object reference
    const clueKey = `${clue.number}-${clue.direction}-${clue.text}`;

    // Skip if clue content hasn't actually changed
    if (prevClueTextRef.current === clueKey) return;
    prevClueTextRef.current = clueKey;

    const el = textRef.current;

    // Find the largest font size that fits within 2 lines
    let targetSize = DEFAULT_FONT_SIZE;

    for (const size of FONT_SIZES) {
      el.style.fontSize = size;

      // Measure at current size
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
      const maxHeight = lineHeight * 2; // 2 lines

      if (el.scrollHeight <= maxHeight + 2) {
        // This size fits - use it
        targetSize = size;
        break;
      }

      // If we've reached the minimum size, use it regardless
      if (size === MIN_FONT_SIZE) {
        targetSize = size;
        break;
      }
    }

    // Apply correct size directly to DOM - this ensures correct size even if
    // React doesn't re-render (e.g., when state value hasn't changed)
    el.style.fontSize = targetSize;

    // Also update state for consistency with React's controlled style
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Necessary: sync state with DOM measurement
    setFontSize(targetSize);
  }, [clue]);

  if (!clue) {
    return (
      <div className="clue-bar clue-bar--empty">
        <span className="clue-bar__placeholder">Select a cell to see clue</span>
      </div>
    );
  }

  const directionLabel = clue.direction === 'across' ? 'A' : 'D';

  return (
    <div className="clue-bar" {...swipeHandlers}>
      <button
        type="button"
        className="clue-bar__nav-btn"
        onClick={onPrevClue}
        disabled={!hasPrev}
        aria-label="Previous clue"
      >
        <svg className="clue-bar__nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <div
        className={`clue-bar__content${onToggleDirection ? ' clue-bar__content--tappable' : ''}`}
        onClick={onToggleDirection}
        role={onToggleDirection ? 'button' : undefined}
        tabIndex={onToggleDirection ? 0 : undefined}
        onKeyDown={onToggleDirection ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation(); // Prevent document-level handler from also firing
            onToggleDirection();
          }
        } : undefined}
      >
        <span
          ref={textRef}
          className="clue-bar__clue-text"
          style={{ fontSize }}
        >
          <span className="clue-bar__number">{clue.number}{directionLabel}:</span>{' '}
          {clue.text}
        </span>
      </div>

      <button
        type="button"
        className="clue-bar__nav-btn"
        onClick={onNextClue}
        disabled={!hasNext}
        aria-label="Next clue"
      >
        <svg className="clue-bar__nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
