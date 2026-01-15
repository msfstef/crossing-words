import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to manage browser history for dialogs.
 * Pushes a history entry when the dialog opens and handles back button navigation.
 *
 * @param isOpen - Whether the dialog is currently open
 * @param onClose - Callback to close the dialog
 * @param dialogType - Identifier for the dialog type (for debugging)
 */
export function useDialogHistory(
  isOpen: boolean,
  onClose: () => void,
  dialogType: string
): void {
  // Track if we have pushed a history entry for this dialog
  const hasHistoryEntryRef = useRef(false);

  // Handle the popstate event (back button pressed)
  useEffect(() => {
    if (!isOpen) return;

    const handlePopstate = () => {
      if (hasHistoryEntryRef.current) {
        hasHistoryEntryRef.current = false;
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [isOpen, onClose]);

  // Push history entry when dialog opens
  useEffect(() => {
    if (isOpen && !hasHistoryEntryRef.current) {
      window.history.pushState({ type: 'dialog', dialogType }, '');
      hasHistoryEntryRef.current = true;
    }
  }, [isOpen, dialogType]);

  // Clean up history when dialog closes normally (not via back button)
  useEffect(() => {
    if (!isOpen && hasHistoryEntryRef.current) {
      hasHistoryEntryRef.current = false;
      window.history.back();
    }
  }, [isOpen]);
}

/**
 * Hook to manage browser history for dialogs with custom open/close functions.
 * Returns functions to open and close the dialog with proper history management.
 *
 * @param setIsOpen - State setter for dialog open state
 * @param dialogType - Identifier for the dialog type (for debugging)
 */
export function useDialogHistoryManagement(
  dialogType: string
): {
  openDialog: () => void;
  closeDialog: () => void;
  handlePopstate: () => void;
  hasHistoryEntry: React.MutableRefObject<boolean>;
} {
  const hasHistoryEntryRef = useRef(false);

  const openDialog = useCallback(() => {
    window.history.pushState({ type: 'dialog', dialogType }, '');
    hasHistoryEntryRef.current = true;
  }, [dialogType]);

  const closeDialog = useCallback(() => {
    if (hasHistoryEntryRef.current) {
      hasHistoryEntryRef.current = false;
      window.history.back();
    }
  }, []);

  const handlePopstate = useCallback(() => {
    if (hasHistoryEntryRef.current) {
      hasHistoryEntryRef.current = false;
      return true; // Indicates dialog should close
    }
    return false;
  }, []);

  return {
    openDialog,
    closeDialog,
    handlePopstate,
    hasHistoryEntry: hasHistoryEntryRef,
  };
}
