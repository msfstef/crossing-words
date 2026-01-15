/**
 * Dialog History Tests
 *
 * Tests for the useDialogHistory hook and dialog history management.
 * These tests verify that dialogs properly integrate with browser history
 * for back button navigation.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDialogHistory } from '../../hooks/useDialogHistory';

describe('useDialogHistory', () => {
  let originalPushState: typeof window.history.pushState;
  let originalBack: typeof window.history.back;
  let pushStateMock: Mock;
  let backMock: Mock;
  let popstateListeners: ((e: PopStateEvent) => void)[];

  beforeEach(() => {
    // Store original methods
    originalPushState = window.history.pushState;
    originalBack = window.history.back;

    // Mock history methods
    pushStateMock = vi.fn();
    backMock = vi.fn();
    window.history.pushState = pushStateMock;
    window.history.back = backMock;

    // Track popstate listeners
    popstateListeners = [];
    const originalAddEventListener = window.addEventListener;
    const originalRemoveEventListener = window.removeEventListener;

    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener) => {
      if (type === 'popstate') {
        popstateListeners.push(listener as (e: PopStateEvent) => void);
      }
      return originalAddEventListener.call(window, type, listener);
    });

    vi.spyOn(window, 'removeEventListener').mockImplementation((type, listener) => {
      if (type === 'popstate') {
        popstateListeners = popstateListeners.filter(l => l !== listener);
      }
      return originalRemoveEventListener.call(window, type, listener);
    });
  });

  afterEach(() => {
    // Restore original methods
    window.history.pushState = originalPushState;
    window.history.back = originalBack;
    vi.restoreAllMocks();
  });

  // Simulate back button press
  const simulateBackButton = () => {
    const event = new PopStateEvent('popstate', { state: null });
    popstateListeners.forEach(listener => listener(event));
  };

  describe('when dialog opens', () => {
    it('should push a history entry when dialog opens', () => {
      const onClose = vi.fn();

      renderHook(() => useDialogHistory(true, onClose, 'test-dialog'));

      expect(pushStateMock).toHaveBeenCalledWith(
        { type: 'dialog', dialogType: 'test-dialog' },
        ''
      );
    });

    it('should only push one history entry even if re-rendered', () => {
      const onClose = vi.fn();

      const { rerender } = renderHook(
        ({ isOpen }) => useDialogHistory(isOpen, onClose, 'test-dialog'),
        { initialProps: { isOpen: true } }
      );

      // Force re-render with same props
      rerender({ isOpen: true });
      rerender({ isOpen: true });

      expect(pushStateMock).toHaveBeenCalledTimes(1);
    });

    it('should not push history entry when dialog is closed', () => {
      const onClose = vi.fn();

      renderHook(() => useDialogHistory(false, onClose, 'test-dialog'));

      expect(pushStateMock).not.toHaveBeenCalled();
    });
  });

  describe('when back button is pressed', () => {
    it('should call onClose when back button is pressed while dialog is open', () => {
      const onClose = vi.fn();

      renderHook(() => useDialogHistory(true, onClose, 'test-dialog'));

      act(() => {
        simulateBackButton();
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not call history.back() after back button closes dialog', () => {
      const onClose = vi.fn();

      const { rerender } = renderHook(
        ({ isOpen }) => useDialogHistory(isOpen, onClose, 'test-dialog'),
        { initialProps: { isOpen: true } }
      );

      // Simulate back button
      act(() => {
        simulateBackButton();
      });

      // Dialog closes (via parent state update after onClose)
      rerender({ isOpen: false });

      // history.back() should NOT be called because dialog was closed via back button
      expect(backMock).not.toHaveBeenCalled();
    });
  });

  describe('when dialog closes normally', () => {
    it('should call history.back() when dialog closes normally (not via back button)', () => {
      const onClose = vi.fn();

      const { rerender } = renderHook(
        ({ isOpen }) => useDialogHistory(isOpen, onClose, 'test-dialog'),
        { initialProps: { isOpen: true } }
      );

      // Dialog closes normally (e.g., via close button)
      rerender({ isOpen: false });

      expect(backMock).toHaveBeenCalledTimes(1);
    });

    it('should remove popstate listener when dialog closes', () => {
      const onClose = vi.fn();

      const { rerender } = renderHook(
        ({ isOpen }) => useDialogHistory(isOpen, onClose, 'test-dialog'),
        { initialProps: { isOpen: true } }
      );

      // Initially there should be a listener
      expect(popstateListeners.length).toBe(1);

      // Close dialog
      rerender({ isOpen: false });

      // Listener should be removed
      expect(popstateListeners.length).toBe(0);
    });
  });

  describe('dialog reopening', () => {
    it('should work correctly when dialog is reopened after back button close', () => {
      const onClose = vi.fn();

      const { rerender } = renderHook(
        ({ isOpen }) => useDialogHistory(isOpen, onClose, 'test-dialog'),
        { initialProps: { isOpen: true } }
      );

      // First: dialog opens and pushes history
      expect(pushStateMock).toHaveBeenCalledTimes(1);

      // Back button closes dialog
      act(() => {
        simulateBackButton();
      });
      rerender({ isOpen: false });

      // Reopen dialog
      rerender({ isOpen: true });

      // Should push another history entry
      expect(pushStateMock).toHaveBeenCalledTimes(2);
    });

    it('should work correctly when dialog is reopened after normal close', () => {
      const onClose = vi.fn();

      const { rerender } = renderHook(
        ({ isOpen }) => useDialogHistory(isOpen, onClose, 'test-dialog'),
        { initialProps: { isOpen: true } }
      );

      // First: dialog opens and pushes history
      expect(pushStateMock).toHaveBeenCalledTimes(1);

      // Close dialog normally
      rerender({ isOpen: false });
      expect(backMock).toHaveBeenCalledTimes(1);

      // Reopen dialog
      rerender({ isOpen: true });

      // Should push another history entry
      expect(pushStateMock).toHaveBeenCalledTimes(2);
    });
  });
});
