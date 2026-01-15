/**
 * JoinDialog component for merge/start-fresh choice when joining a shared session
 *
 * Displays when a user clicks a share link but has existing local progress
 * for the same puzzle. Offers three options:
 * - Merge Progress: Connect to shared session with local state (Yjs merges automatically)
 * - Start Fresh: Clear local state before connecting to shared session
 * - Cancel: Stay on local timeline, don't join shared session
 */

import { useEffect, useRef } from 'react';
import { useDialogHistory } from '../hooks/useDialogHistory';
import './JoinDialog.css';

interface JoinDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Title of the puzzle being joined */
  puzzleTitle: string;
  /** Number of local entries (-1 means "some progress" without exact count) */
  localEntryCount: number;
  /** Callback when user chooses to merge their progress */
  onMerge: () => void;
  /** Callback when user chooses to start fresh */
  onStartFresh: () => void;
  /** Callback when user cancels (stays local) */
  onCancel: () => void;
}

/**
 * Modal dialog for choosing how to handle existing local progress when joining a shared session.
 *
 * Features:
 * - Clear explanation of the situation
 * - Three options with descriptive text
 * - Click outside or Escape to cancel
 * - Accessible dialog element
 *
 * @example
 * ```tsx
 * <JoinDialog
 *   isOpen={showJoinDialog}
 *   puzzleTitle="NYT Daily Crossword"
 *   localEntryCount={15}
 *   onMerge={() => handleMerge()}
 *   onStartFresh={() => handleStartFresh()}
 *   onCancel={() => handleCancel()}
 * />
 * ```
 */
export function JoinDialog({
  isOpen,
  puzzleTitle,
  localEntryCount,
  onMerge,
  onStartFresh,
  onCancel,
}: JoinDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Handle back button navigation
  useDialogHistory(isOpen, onCancel, 'join');

  // Open/close the dialog element
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  // Handle Escape key and click outside
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCancel();
    };

    // Check if event coordinates are outside the dialog bounds
    const isClickOutside = (clientX: number, clientY: number): boolean => {
      const rect = dialog.getBoundingClientRect();
      return (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      );
    };

    const handleClick = (e: MouseEvent) => {
      // Close if clicking on the backdrop (outside the dialog content)
      if (isClickOutside(e.clientX, e.clientY)) {
        onCancel();
      }
    };

    // Handle touch events for mobile - use touchend for consistency
    const handleTouchEnd = (e: TouchEvent) => {
      // Only handle single touch
      if (e.changedTouches.length !== 1) return;
      const touch = e.changedTouches[0];
      if (isClickOutside(touch.clientX, touch.clientY)) {
        // Prevent the subsequent click event from also firing
        e.preventDefault();
        onCancel();
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleClick);
    dialog.addEventListener('touchend', handleTouchEnd);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleClick);
      dialog.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onCancel]);

  if (!isOpen) {
    return null;
  }

  // Format progress message
  const progressMessage =
    localEntryCount > 0
      ? `You have ${localEntryCount} letter${localEntryCount !== 1 ? 's' : ''} filled in locally.`
      : localEntryCount === -1
        ? 'You have progress on this puzzle locally.'
        : 'You have existing progress on this puzzle.';

  return (
    <dialog ref={dialogRef} className="join-dialog">
      <div className="join-dialog__content">
        <h2 className="join-dialog__heading">Join collaborative session?</h2>

        <p className="join-dialog__puzzle-title">{puzzleTitle}</p>

        <p className="join-dialog__message">{progressMessage}</p>

        <p className="join-dialog__question">What would you like to do?</p>

        <div className="join-dialog__options">
          <button
            type="button"
            className="join-dialog__option join-dialog__option--merge"
            onClick={onMerge}
          >
            <span className="join-dialog__option-title">Merge Progress</span>
            <span className="join-dialog__option-description">
              Combine your work with the shared session
            </span>
          </button>

          <button
            type="button"
            className="join-dialog__option join-dialog__option--fresh"
            onClick={onStartFresh}
          >
            <span className="join-dialog__option-title">Start Fresh</span>
            <span className="join-dialog__option-description">
              Join without your local progress
            </span>
          </button>

          <button
            type="button"
            className="join-dialog__option join-dialog__option--cancel"
            onClick={onCancel}
          >
            <span className="join-dialog__option-title">Cancel</span>
            <span className="join-dialog__option-description">
              Stay with your local progress
            </span>
          </button>
        </div>
      </div>
    </dialog>
  );
}
