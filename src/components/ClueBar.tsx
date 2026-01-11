import './ClueBar.css';

interface ClueBarProps {
  clue: {
    number: number;
    direction: 'across' | 'down';
    text: string;
  } | null;
}

/**
 * ClueBar displays the current clue below the crossword grid
 */
export function ClueBar({ clue }: ClueBarProps) {
  if (!clue) {
    return (
      <div className="clue-bar clue-bar--empty">
        <span className="clue-bar__placeholder">Select a cell to see clue</span>
      </div>
    );
  }

  const directionLabel = clue.direction === 'across' ? 'Across' : 'Down';

  return (
    <div className="clue-bar">
      <span className="clue-bar__number">{clue.number}</span>
      <span className="clue-bar__direction">{directionLabel}:</span>
      <span className="clue-bar__text">{clue.text}</span>
    </div>
  );
}
