import './PuzzleCard.css';

interface PuzzleCardProps {
  id: string;
  title: string;
  source?: string;
  date?: string;
  progress: { filled: number; total: number };
  onOpen: () => void;
  onDelete: () => void;
}

/**
 * Card displaying a puzzle in the library with progress indicator.
 * Shows source/title, progress bar, and delete button.
 */
export function PuzzleCard({
  title,
  source,
  progress,
  onOpen,
  onDelete,
}: PuzzleCardProps) {
  const { filled, total } = progress;

  // Calculate percentage
  // filled = -1 means "has progress but unknown count"
  const isComplete = filled === total && total > 0;
  const percentage = filled > 0 ? Math.round((filled / total) * 100) : (filled === -1 ? 50 : 0);

  // Display text for progress
  const progressText = isComplete
    ? '✓'
    : filled === -1
    ? 'In progress'
    : `${percentage}%`;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger onOpen
    onDelete();
  };

  return (
    <div
      className="puzzle-card"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="puzzle-card__content">
        <div className="puzzle-card__info">
          <span className="puzzle-card__title">{source ?? title}</span>
          {source && source !== title && (
            <span className="puzzle-card__subtitle">{title}</span>
          )}
        </div>

        <div className="puzzle-card__progress">
          <div className="puzzle-card__progress-bar">
            <div
              className={`puzzle-card__progress-fill ${isComplete ? 'puzzle-card__progress-fill--complete' : ''}`}
              style={{ width: `${isComplete ? 100 : (filled === -1 ? 50 : percentage)}%` }}
            />
          </div>
          <span className={`puzzle-card__progress-text ${isComplete ? 'puzzle-card__progress-text--complete' : ''}`}>
            {progressText}
          </span>
        </div>
      </div>

      <button
        type="button"
        className="puzzle-card__delete"
        onClick={handleDelete}
        aria-label={`Delete ${title}`}
      >
        ×
      </button>
    </div>
  );
}
