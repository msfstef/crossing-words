/**
 * ShareDialog component for sharing collaborative puzzle sessions
 *
 * Displays a modal with:
 * - QR code for easy mobile scanning
 * - Copyable share URL
 * - Copy Link button with feedback
 * - Share button (native share sheet on supported platforms)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  shareSession,
  copyToClipboard,
  type ShareResult,
} from '../collaboration/sessionUrl';
import './ShareDialog.css';

interface ShareDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** The full shareable URL */
  shareUrl: string;
  /** Title of the puzzle being shared */
  puzzleTitle: string;
}

/**
 * Modal dialog for sharing a collaborative puzzle session.
 *
 * Features:
 * - QR code rendered with dark theme colors
 * - Readonly URL field for visual reference
 * - Copy Link button with "Copied!" feedback
 * - Share button using Web Share API (hidden on unsupported browsers)
 * - Click outside or Escape to close
 *
 * @example
 * ```tsx
 * <ShareDialog
 *   isOpen={showShare}
 *   onClose={() => setShowShare(false)}
 *   shareUrl="https://example.com/#puzzle=abc&timeline=xyz"
 *   puzzleTitle="NYT Daily Crossword"
 * />
 * ```
 */
/** Duration of the close animation in ms */
const CLOSE_ANIMATION_DURATION = 120;

export function ShareDialog({
  isOpen,
  onClose,
  shareUrl,
  puzzleTitle,
}: ShareDialogProps) {
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  // Track visibility separately from isOpen prop to allow close animation
  const [isVisible, setIsVisible] = useState(isOpen);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  // Check if native sharing is supported
  useEffect(() => {
    const shareData = { title: 'Test', url: 'https://example.com' };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- One-time feature detection on mount
    setCanShare(!!navigator.canShare?.(shareData));
  }, []);

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

  // Clear copy feedback timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const showCopyFeedback = useCallback((result: ShareResult) => {
    // Clear any existing timeout
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }

    switch (result) {
      case 'copied':
        setCopyFeedback('Copied!');
        break;
      case 'failed':
        setCopyFeedback('Copy failed');
        break;
      case 'cancelled':
        setCopyFeedback(null);
        return; // Don't set timeout for cancelled
      default:
        setCopyFeedback(null);
        return;
    }

    // Auto-clear feedback after 2 seconds
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopyFeedback(null);
    }, 2000);
  }, []);

  const handleCopyLink = useCallback(async () => {
    const result = await shareSession(shareUrl, `Join: ${puzzleTitle}`);
    showCopyFeedback(result);
  }, [shareUrl, puzzleTitle, showCopyFeedback]);

  const handleShare = useCallback(async () => {
    const result = await shareSession(shareUrl, `Join: ${puzzleTitle}`);
    if (result === 'shared') {
      onClose();
    } else {
      showCopyFeedback(result);
    }
  }, [shareUrl, puzzleTitle, onClose, showCopyFeedback]);

  const handleUrlInputClick = useCallback(
    async (e: React.MouseEvent<HTMLInputElement>) => {
      (e.target as HTMLInputElement).select();
      const success = await copyToClipboard(shareUrl);
      showCopyFeedback(success ? 'copied' : 'failed');
    },
    [shareUrl, showCopyFeedback]
  );

  // Only render when visible (stays visible during close animation)
  if (!isVisible) {
    return null;
  }

  // isClosing = prop says closed but we're still visible (animating out)
  const isClosing = !isOpen && isVisible;

  return (
    <dialog
      ref={dialogRef}
      className={`share-dialog${isClosing ? ' share-dialog--closing' : ''}`}
    >
      <div className="share-dialog__content">
        <button
          type="button"
          className="share-dialog__close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          &times;
        </button>

        <h2 className="share-dialog__heading">Share this puzzle</h2>

        <div className="share-dialog__qr-container">
          <QRCodeSVG
            value={shareUrl}
            size={200}
            level="H"
            marginSize={4}
            bgColor="#ffffff"
            fgColor="#000000"
          />
        </div>

        <div className="share-dialog__url-container">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="share-dialog__url-input"
            onClick={handleUrlInputClick}
            aria-label="Share URL - tap to copy"
          />
        </div>

        <div className="share-dialog__actions">
          <button
            type="button"
            className="share-dialog__button share-dialog__button--copy"
            onClick={handleCopyLink}
          >
            {copyFeedback ?? 'Copy Link'}
          </button>

          {canShare && (
            <button
              type="button"
              className="share-dialog__button share-dialog__button--share"
              onClick={handleShare}
            >
              Share
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
