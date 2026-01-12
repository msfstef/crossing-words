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
