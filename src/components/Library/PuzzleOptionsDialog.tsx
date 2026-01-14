import { useEffect, useRef, useState } from 'react';
import './PuzzleOptionsDialog.css';

interface PuzzleOptionsDialogProps {
  isOpen: boolean;
  puzzleTitle: string;
  puzzleDate?: string;
  onClose: () => void;
  onResetPuzzle: () => void;
  onResetSharing: () => void;
  onDelete: () => void;
}

/**
 * Dialog showing options for a puzzle (reset, delete, etc.).
 * Triggered by long press on a puzzle card.
 */
export function PuzzleOptionsDialog({
  isOpen,
  puzzleTitle,
  puzzleDate,
  onClose,
  onResetPuzzle,
  onResetSharing,
  onDelete,
}: PuzzleOptionsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const historyPushedRef = useRef(false);

  // Track touch for swipe down gesture
  const touchStartRef = useRef<{ y: number; time: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const handleClose = () => {
    setIsClosing(true);
    // Wait for animation to complete before actually closing
    setTimeout(() => {
      setIsClosing(false);
      setDragOffset(0);
      onClose();
    }, 200); // Match animation duration
  };

  // Close dialog on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Close dialog when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    // Add listener after a brief delay to avoid closing immediately
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle back button
  useEffect(() => {
    if (!isOpen) return;

    // Push history state when dialog opens
    if (!historyPushedRef.current) {
      window.history.pushState({ type: 'dialog', dialogType: 'puzzle-options' }, '');
      historyPushedRef.current = true;
    }

    const handlePopstate = () => {
      if (historyPushedRef.current) {
        historyPushedRef.current = false;
        handleClose();
      }
    };

    window.addEventListener('popstate', handlePopstate);
    return () => {
      window.removeEventListener('popstate', handlePopstate);
    };
  }, [isOpen]);

  // Clean up history when dialog closes normally (not via back button)
  useEffect(() => {
    if (!isOpen && historyPushedRef.current) {
      historyPushedRef.current = false;
      window.history.back();
    }
  }, [isOpen]);

  // Handle swipe down gesture on mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { y: touch.clientY, time: Date.now() };
    setDragOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !dialogRef.current) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Only allow downward drag
    if (deltaY > 0) {
      setDragOffset(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current) return;

    const SWIPE_THRESHOLD = 100; // pixels
    const VELOCITY_THRESHOLD = 0.5; // pixels per ms

    const duration = Date.now() - touchStartRef.current.time;
    const velocity = dragOffset / duration;

    // Close if dragged far enough or fast enough
    if (dragOffset > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      handleClose();
    } else {
      // Snap back
      setDragOffset(0);
    }

    touchStartRef.current = null;
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div className={`puzzle-options-overlay ${isClosing ? 'puzzle-options-overlay--closing' : ''}`}>
      <div
        className={`puzzle-options-dialog ${isClosing ? 'puzzle-options-dialog--closing' : ''}`}
        ref={dialogRef}
        style={dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="puzzle-options-header">
          <div className="puzzle-options-title-group">
            <h3 className="puzzle-options-title">{puzzleTitle}</h3>
            {puzzleDate && (
              <span className="puzzle-options-date">{puzzleDate}</span>
            )}
          </div>
          <button
            type="button"
            className="puzzle-options-close"
            onClick={handleClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="puzzle-options-actions">
          <button
            type="button"
            className="puzzle-options-button"
            onClick={() => {
              onResetPuzzle();
              handleClose();
            }}
          >
            <svg
              className="puzzle-options-button-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 1 1-9-9 7 7 0 0 1 7 7" />
              <polyline points="21 5 21 12 14 12" />
            </svg>
            <div className="puzzle-options-button-text">
              <span className="puzzle-options-button-label">Reset Puzzle</span>
              <span className="puzzle-options-button-desc">
                Clear all progress and start fresh
              </span>
            </div>
          </button>

          <button
            type="button"
            className="puzzle-options-button"
            onClick={() => {
              onResetSharing();
              handleClose();
            }}
          >
            <svg
              className="puzzle-options-button-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <div className="puzzle-options-button-text">
              <span className="puzzle-options-button-label">Reset Sharing</span>
              <span className="puzzle-options-button-desc">
                Generate new link, keep progress
              </span>
            </div>
          </button>

          <button
            type="button"
            className="puzzle-options-button puzzle-options-button--danger"
            onClick={() => {
              onDelete();
              handleClose();
            }}
          >
            <svg
              className="puzzle-options-button-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            <div className="puzzle-options-button-text">
              <span className="puzzle-options-button-label">Delete</span>
              <span className="puzzle-options-button-desc">
                Remove puzzle permanently
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
