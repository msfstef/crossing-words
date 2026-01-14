/**
 * SuccessDialog component for puzzle completion
 *
 * Displays a celebratory modal when the puzzle is completed correctly.
 * Offers options to continue viewing the puzzle or return to the library.
 */

import { useEffect, useRef, useState } from 'react';
import './SuccessDialog.css';

/** Duration of the close animation in ms */
const CLOSE_ANIMATION_DURATION = 150;

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Track visibility separately from isOpen prop to allow close animation
  const [isVisible, setIsVisible] = useState(isOpen);

  // Handle visibility transitions with animation
  useEffect(() => {
    if (isOpen) {
      // Opening: show immediately
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Necessary for open/close animation sync
      setIsVisible(true);
    } else if (isVisible) {
      // Closing: wait for animation before hiding
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, CLOSE_ANIMATION_DURATION);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isVisible]);

  // Open/close the native dialog element
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isVisible && isOpen) {
      dialog.showModal();
    } else if (!isVisible) {
      dialog.close();
    }
  }, [isVisible, isOpen]);

  // Handle Escape key and click outside
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    const handleClick = (e: MouseEvent) => {
      // Close if clicking on the backdrop (outside the dialog content)
      const rect = dialog.getBoundingClientRect();
      const isInDialog =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (!isInDialog) {
        onClose();
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleClick);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleClick);
    };
  }, [onClose]);

  // Only render when visible (stays visible during close animation)
  if (!isVisible) {
    return null;
  }

  // isClosing = prop says closed but we're still visible (animating out)
  const isClosing = !isOpen && isVisible;
  const isMultiplayer = collaboratorCount > 0;

  return (
    <dialog
      ref={dialogRef}
      className={`success-dialog${isClosing ? ' success-dialog--closing' : ''}`}
    >
      <div className="success-dialog__content">
        <button
          type="button"
          className="success-dialog__close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          &times;
        </button>

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
      </div>
    </dialog>
  );
}
