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
}

/**
 * ClueBar displays the current clue with prev/next navigation buttons
 */
export function ClueBar({
  clue,
  onPrevClue,
  onNextClue,
  hasPrev = false,
  hasNext = false,
}: ClueBarProps) {
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
        ◀
      </button>

      <div className="clue-bar__content">
        <span className="clue-bar__number">{clue.number}{directionLabel}:</span>
        <span className="clue-bar__text">{clue.text}</span>
      </div>

      <button
        type="button"
        className="clue-bar__nav-btn"
        onClick={onNextClue}
        disabled={!hasNext}
        aria-label="Next clue"
      >
        ▶
      </button>
    </div>
  );
}
