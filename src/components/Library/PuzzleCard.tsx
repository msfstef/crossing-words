import { useRef, useState } from 'react';
import './PuzzleCard.css';
import { ProgressCircle } from './ProgressCircle';

interface PuzzleCardProps {
  id: string;
  title: string;
  source?: string;
  date?: string;
  progress: { filled: number; verified: number; total: number };
  onOpen: () => void;
  onDelete: () => void;
  onLongPress?: () => void;
}

const LONG_PRESS_DURATION = 350; // milliseconds - optimized for native feel

/**
 * Card displaying a puzzle in the library with progress indicator.
 * Shows source/title, progress bar, and delete button.
 * Supports long press to show options menu.
 */
export function PuzzleCard({
  title,
  source,
  progress,
  onOpen,
  onDelete,
  onLongPress,
}: PuzzleCardProps) {
  const { filled, verified, total } = progress;
  const longPressTimerRef = useRef<number | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isPressed, setIsPressed] = useState(false);

  // Calculate percentage - isComplete only when all cells are verified (correct)
  const isComplete = verified === total && total > 0;
  const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger onOpen
    onDelete();
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pressStartRef.current = null;
    setIsPressed(false);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Ignore if clicking on delete button
    if ((e.target as HTMLElement).closest('.puzzle-card__delete')) {
      return;
    }

    // Record press start position
    pressStartRef.current = { x: e.clientX, y: e.clientY };
    setIsPressed(true);

    // Start long press timer
    longPressTimerRef.current = window.setTimeout(() => {
      if (pressStartRef.current && onLongPress) {
        onLongPress();
        cancelLongPress();
      }
    }, LONG_PRESS_DURATION);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // Cancel long press if user moves too far
    if (pressStartRef.current) {
      const deltaX = Math.abs(e.clientX - pressStartRef.current.x);
      const deltaY = Math.abs(e.clientY - pressStartRef.current.y);
      const MOVE_THRESHOLD = 10; // pixels

      if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
        cancelLongPress();
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    // If long press timer is still running, it's a normal click
    if (longPressTimerRef.current && pressStartRef.current) {
      cancelLongPress();
      // Only trigger onOpen if not clicking delete button
      if (!(e.target as HTMLElement).closest('.puzzle-card__delete')) {
        onOpen();
      }
    } else {
      cancelLongPress();
    }
  };

  const handlePointerCancel = () => {
    cancelLongPress();
  };

  return (
    <div
      className={`puzzle-card ${isPressed ? 'puzzle-card--pressed' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
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
