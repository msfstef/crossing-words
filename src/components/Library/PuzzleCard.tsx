import './PuzzleCard.css';
import { ProgressCircle } from './ProgressCircle';

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
  const isComplete = filled === total && total > 0;
  const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;

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
          {source && (
            <span className="puzzle-card__subtitle">{title}</span>
          )}
        </div>

        <div className="puzzle-card__progress">
          <ProgressCircle percentage={percentage} isComplete={isComplete} />
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
