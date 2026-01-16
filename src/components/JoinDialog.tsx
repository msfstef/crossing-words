/**
 * JoinDialog component for merge/start-fresh choice when joining a shared session
 *
 * Displays when a user clicks a share link but has existing local progress
 * for the same puzzle. Offers three options:
 * - Merge Progress: Connect to shared session with local state (Yjs merges automatically)
 * - Start Fresh: Clear local state before connecting to shared session
 * - Cancel: Stay on local timeline, don't join shared session
 */

import { Dialog } from './Dialog';
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
  // Format progress message
  const progressMessage =
    localEntryCount > 0
      ? `You have ${localEntryCount} letter${localEntryCount !== 1 ? 's' : ''} filled in locally.`
      : localEntryCount === -1
        ? 'You have progress on this puzzle locally.'
        : 'You have existing progress on this puzzle.';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onCancel}
      className="join-dialog"
      dialogId="join"
    >
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
    </Dialog>
  );
}
