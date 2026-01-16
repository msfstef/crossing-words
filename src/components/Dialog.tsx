/**
 * Unified Dialog component using native HTML <dialog> element.
 *
 * Features:
 * - Native <dialog> with showModal() for proper modal behavior
 * - CloseWatcher support for Android back button (Chrome 126+)
 * - Fallback history management for older browsers
 * - Click-outside to close (backdrop click)
 * - Escape key handling via native cancel event
 * - Close animation support
 * - Touch-friendly backdrop handling
 *
 * The component relies on Chrome's native CloseWatcher integration with <dialog>
 * which automatically handles Android back button/gesture. For browsers without
 * CloseWatcher support, it falls back to the History API pattern.
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
  type ReactNode,
} from 'react';
import './Dialog.css';

/** Duration of close animation in ms - should match CSS */
const CLOSE_ANIMATION_DURATION = 150;

/**
 * Check if the browser supports CloseWatcher API.
 * When supported, <dialog>.showModal() automatically integrates with it.
 */
function supportsCloseWatcher(): boolean {
  return typeof window !== 'undefined' && 'CloseWatcher' in window;
}

export interface DialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Dialog content */
  children: ReactNode;
  /** Additional class name for the dialog element */
  className?: string;
  /** Whether to allow closing by clicking outside (default: true) */
  closeOnBackdropClick?: boolean;
  /**
   * Optional callback to dynamically control backdrop click closing.
   * Called before closing on backdrop click. Return false to prevent close.
   * Useful for preventing close when file pickers are open.
   */
  shouldCloseOnBackdropClick?: () => boolean;
  /** Whether to show close button (default: true) */
  showCloseButton?: boolean;
  /** Aria label for close button */
  closeButtonAriaLabel?: string;
  /** ID for dialog type (used in history state, for debugging) */
  dialogId?: string;
  /** Custom close animation duration in ms */
  animationDuration?: number;
}

export interface DialogRef {
  /** The underlying dialog element */
  dialogElement: HTMLDialogElement | null;
}

/**
 * Unified modal dialog component.
 *
 * @example
 * ```tsx
 * <Dialog isOpen={showDialog} onClose={() => setShowDialog(false)}>
 *   <h2>Dialog Title</h2>
 *   <p>Dialog content here</p>
 * </Dialog>
 * ```
 */
export const Dialog = forwardRef<DialogRef, DialogProps>(function Dialog(
  {
    isOpen,
    onClose,
    children,
    className = '',
    closeOnBackdropClick = true,
    shouldCloseOnBackdropClick,
    showCloseButton = true,
    closeButtonAriaLabel = 'Close dialog',
    dialogId = 'dialog',
    animationDuration = CLOSE_ANIMATION_DURATION,
  },
  ref
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const hasHistoryEntryRef = useRef(false);
  const closeWatcherRef = useRef<CloseWatcher | null>(null);

  // Track visibility separately from isOpen prop to allow close animation
  const [isVisible, setIsVisible] = useState(isOpen);

  // Expose dialog element via ref
  useImperativeHandle(ref, () => ({
    dialogElement: dialogRef.current,
  }));

  // Stable close handler
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Handle visibility transitions with animation
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Necessary for open/close animation sync
      setIsVisible(true);
    } else if (isVisible) {
      // Closing: wait for animation before hiding
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, animationDuration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isVisible, animationDuration]);

  // Open/close the native dialog element
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isVisible && isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (!isVisible) {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isVisible, isOpen]);

  // Set up CloseWatcher for browsers that support it (manual instance)
  // Note: <dialog>.showModal() auto-integrates with CloseWatcher in Chrome 126+,
  // but we create our own for more control and to handle the close gracefully
  useEffect(() => {
    if (!isOpen || !isVisible) return;

    // Only use manual CloseWatcher if supported and dialog is open
    if (supportsCloseWatcher()) {
      try {
        const watcher = new CloseWatcher();
        closeWatcherRef.current = watcher;

        watcher.onclose = () => {
          handleClose();
        };

        return () => {
          watcher.destroy();
          closeWatcherRef.current = null;
        };
      } catch {
        // CloseWatcher creation can fail if not triggered by user activation
        // This is fine - we'll fall back to history management
      }
    }
  }, [isOpen, isVisible, handleClose]);

  // Fallback: History-based back button handling for browsers without CloseWatcher
  useEffect(() => {
    if (!isOpen || supportsCloseWatcher()) return;

    // Push history entry when dialog opens
    if (!hasHistoryEntryRef.current) {
      window.history.pushState({ type: 'dialog', dialogId }, '');
      hasHistoryEntryRef.current = true;
    }

    const handlePopstate = () => {
      if (hasHistoryEntryRef.current) {
        hasHistoryEntryRef.current = false;
        handleClose();
      }
    };

    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [isOpen, dialogId, handleClose]);

  // Clean up history entry when dialog closes normally (not via back button)
  // Only for browsers without CloseWatcher
  useEffect(() => {
    if (!isOpen && hasHistoryEntryRef.current && !supportsCloseWatcher()) {
      hasHistoryEntryRef.current = false;
      window.history.back();
    }
  }, [isOpen]);

  // Handle native cancel event (Escape key, and CloseWatcher in supported browsers)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      // Prevent default to control our own close behavior (animation)
      e.preventDefault();
      handleClose();
    };

    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [handleClose]);

  // Handle click/touch outside dialog content
  useEffect(() => {
    if (!closeOnBackdropClick) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

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
      if (isClickOutside(e.clientX, e.clientY)) {
        // Check dynamic callback if provided
        if (shouldCloseOnBackdropClick && !shouldCloseOnBackdropClick()) {
          return;
        }
        handleClose();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length !== 1) return;
      const touch = e.changedTouches[0];
      if (isClickOutside(touch.clientX, touch.clientY)) {
        // Check dynamic callback if provided
        if (shouldCloseOnBackdropClick && !shouldCloseOnBackdropClick()) {
          return;
        }
        e.preventDefault();
        handleClose();
      }
    };

    dialog.addEventListener('click', handleClick);
    dialog.addEventListener('touchend', handleTouchEnd);

    return () => {
      dialog.removeEventListener('click', handleClick);
      dialog.removeEventListener('touchend', handleTouchEnd);
    };
  }, [closeOnBackdropClick, shouldCloseOnBackdropClick, handleClose]);

  // Don't render when fully closed
  if (!isVisible) {
    return null;
  }

  const isClosing = !isOpen && isVisible;

  return (
    <dialog
      ref={dialogRef}
      className={`dialog ${className} ${isClosing ? 'dialog--closing' : ''}`}
    >
      <div className="dialog__content">
        {showCloseButton && (
          <button
            type="button"
            className="dialog__close"
            onClick={handleClose}
            aria-label={closeButtonAriaLabel}
          >
            &times;
          </button>
        )}
        {children}
      </div>
    </dialog>
  );
});

// TypeScript declaration for CloseWatcher (not yet in standard lib types)
declare global {
  interface Window {
    CloseWatcher?: typeof CloseWatcher;
  }

  class CloseWatcher {
    constructor();
    onclose: (() => void) | null;
    oncancel: ((e: Event) => void) | null;
    close(): void;
    destroy(): void;
  }
}
