import { useEffect, useRef } from 'react';
import './PuzzleOptionsDialog.css';

interface PuzzleOptionsDialogProps {
  isOpen: boolean;
  puzzleTitle: string;
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
  onClose,
  onResetPuzzle,
  onResetSharing,
  onDelete,
}: PuzzleOptionsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close dialog on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close dialog when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="puzzle-options-overlay">
      <div className="puzzle-options-dialog" ref={dialogRef}>
        <div className="puzzle-options-header">
          <h3 className="puzzle-options-title">{puzzleTitle}</h3>
          <button
            type="button"
            className="puzzle-options-close"
            onClick={onClose}
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
              onClose();
            }}
          >
            <span className="puzzle-options-button-icon">↺</span>
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
              onClose();
            }}
          >
            <span className="puzzle-options-button-icon">🔗</span>
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
              onClose();
            }}
          >
            <span className="puzzle-options-button-icon">🗑</span>
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
