import { useRef, useLayoutEffect, useState } from 'react';
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
}

const DEFAULT_FONT_SIZE = '0.9375rem';
const SMALL_FONT_SIZE = '0.8125rem';

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
}: ClueBarProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState<string>(DEFAULT_FONT_SIZE);

  // Measure text and shrink font if needed to fit in 2 lines
  // Use useLayoutEffect to measure and set size BEFORE paint (prevents flicker)
  useLayoutEffect(() => {
    if (!clue || !textRef.current) return;

    const el = textRef.current;

    // Temporarily set to default size for measurement (direct DOM manipulation)
    el.style.fontSize = DEFAULT_FONT_SIZE;

    // Measure at default size
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
    const maxHeight = lineHeight * 2; // 2 lines
    const needsSmallFont = el.scrollHeight > maxHeight + 2;

    // Set the correct size - React will apply this on re-render before paint
    setFontSize(needsSmallFont ? SMALL_FONT_SIZE : DEFAULT_FONT_SIZE);
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
    <div className="clue-bar">
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
