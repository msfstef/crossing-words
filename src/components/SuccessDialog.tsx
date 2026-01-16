/**
 * SuccessDialog component for puzzle completion
 *
 * Displays a celebratory modal when the puzzle is completed correctly.
 * Offers options to continue viewing the puzzle or return to the library.
 */

import { Dialog } from './Dialog';
import './SuccessDialog.css';

interface SuccessDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog should close (continue viewing) */
  onClose: () => void;
  /** Callback to navigate back to library */
  onBackToLibrary: () => void;
  /** Title of the completed puzzle */
  puzzleTitle: string;
  /** Number of collaborators (for multiplayer message) */
  collaboratorCount?: number;
  /** Formatted play time duration (e.g., "5:23") */
  duration?: string;
}

/**
 * Modal dialog displayed when a puzzle is completed correctly.
 *
 * Features:
 * - Celebratory message and checkmark icon
 * - Shows puzzle title
 * - "Continue" button to keep viewing the solved puzzle
 * - "Back to Library" button to return to puzzle list
 * - Click outside or Escape to close
 *
 * @example
 * ```tsx
 * <SuccessDialog
 *   isOpen={showSuccess}
 *   onClose={() => setShowSuccess(false)}
 *   onBackToLibrary={handleBackToLibrary}
 *   puzzleTitle="NYT Daily Crossword"
 *   collaboratorCount={2}
 * />
 * ```
 */
export function SuccessDialog({
  isOpen,
  onClose,
  onBackToLibrary,
  puzzleTitle,
  collaboratorCount = 0,
  duration,
}: SuccessDialogProps) {
  const isMultiplayer = collaboratorCount > 0;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      className="success-dialog"
      dialogId="success"
    >
      <div className="success-dialog__icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <h2 className="success-dialog__heading">Puzzle Complete!</h2>

      <p className="success-dialog__puzzle-title">{puzzleTitle}</p>

      {duration && (
        <div className="success-dialog__duration">
          <span className="success-dialog__duration-label">Time</span>
          <span className="success-dialog__duration-value">{duration}</span>
        </div>
      )}

      {isMultiplayer && (
        <p className="success-dialog__multiplayer-note">
          Solved together with {collaboratorCount} other{collaboratorCount > 1 ? 's' : ''}
        </p>
      )}

      <div className="success-dialog__actions">
        <button
          type="button"
          className="success-dialog__button success-dialog__button--secondary"
          onClick={onBackToLibrary}
        >
          Back to Library
        </button>
        <button
          type="button"
          className="success-dialog__button success-dialog__button--primary"
          onClick={onClose}
        >
          Continue
        </button>
      </div>
    </Dialog>
  );
}
