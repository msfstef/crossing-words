/**
 * Dialog Component Tests
 *
 * Tests for the base Dialog component, especially the protection period
 * that prevents immediate closing on Android Chrome.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { Dialog } from '../../components/Dialog';

// Mock CloseWatcher to simulate Android Chrome behavior
class MockCloseWatcher {
  onclose: (() => void) | null = null;
  oncancel: ((e: Event) => void) | null = null;

  close(): void {
    if (this.onclose) {
      this.onclose();
    }
  }

  destroy(): void {
    this.onclose = null;
    this.oncancel = null;
  }
}

describe('Dialog', () => {
  let originalCloseWatcher: typeof window.CloseWatcher;

  beforeEach(() => {
    // Store original and set up mock
    originalCloseWatcher = window.CloseWatcher;
    window.CloseWatcher = MockCloseWatcher as unknown as typeof CloseWatcher;
  });

  afterEach(() => {
    // Restore original
    window.CloseWatcher = originalCloseWatcher;
    vi.restoreAllMocks();
  });

  describe('basic functionality', () => {
    it('should render when isOpen is true', () => {
      render(
        <Dialog isOpen={true} onClose={() => {}}>
          <p>Dialog content</p>
        </Dialog>
      );

      expect(screen.getByText('Dialog content')).toBeTruthy();
    });

    it('should not render when isOpen is false', () => {
      render(
        <Dialog isOpen={false} onClose={() => {}}>
          <p>Dialog content</p>
        </Dialog>
      );

      expect(screen.queryByText('Dialog content')).toBeNull();
    });

    it('should call onClose when close button is clicked after protection period', async () => {
      vi.useFakeTimers();
      const onClose = vi.fn();

      render(
        <Dialog isOpen={true} onClose={onClose}>
          <p>Dialog content</p>
        </Dialog>
      );

      // Wait for protection period to expire
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      // Click close button using fireEvent (works better with fake timers)
      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });

  describe('protection period (Android Chrome race condition fix)', () => {
    it('should NOT close when CloseWatcher fires immediately after opening', async () => {
      vi.useFakeTimers();
      const onClose = vi.fn();
      const instances: MockCloseWatcher[] = [];

      // Capture the CloseWatcher instance when it's created using a spy
      const originalMock = MockCloseWatcher;
      vi.spyOn(window, 'CloseWatcher').mockImplementation(function (this: MockCloseWatcher) {
        const instance = new originalMock();
        instances.push(instance);
        return instance;
      } as unknown as () => CloseWatcher);

      render(
        <Dialog isOpen={true} onClose={onClose}>
          <p>Dialog content</p>
        </Dialog>
      );

      // Simulate CloseWatcher firing immediately (within protection period)
      // This simulates the Android Chrome race condition
      await act(async () => {
        vi.advanceTimersByTime(50); // Only 50ms, still in protection period
      });

      const closeWatcherInstance = instances[0];
      if (closeWatcherInstance) {
        act(() => {
          closeWatcherInstance.close();
        });
      }

      // onClose should NOT have been called due to protection period
      expect(onClose).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should close normally after protection period expires', async () => {
      vi.useFakeTimers();
      const onClose = vi.fn();
      const instances: MockCloseWatcher[] = [];

      // Capture the CloseWatcher instance when it's created using a spy
      const originalMock = MockCloseWatcher;
      vi.spyOn(window, 'CloseWatcher').mockImplementation(function (this: MockCloseWatcher) {
        const instance = new originalMock();
        instances.push(instance);
        return instance;
      } as unknown as () => CloseWatcher);

      render(
        <Dialog isOpen={true} onClose={onClose}>
          <p>Dialog content</p>
        </Dialog>
      );

      // Wait for protection period to expire (200ms + buffer)
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      // Now trigger CloseWatcher
      const closeWatcherInstance = instances[0];
      if (closeWatcherInstance) {
        act(() => {
          closeWatcherInstance.close();
        });
      }

      // onClose SHOULD be called now
      expect(onClose).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should protect against immediate backdrop click', async () => {
      vi.useFakeTimers();
      const onClose = vi.fn();

      render(
        <Dialog isOpen={true} onClose={onClose} closeOnBackdropClick={true}>
          <p>Dialog content</p>
        </Dialog>
      );

      // Try to click backdrop immediately (within protection period)
      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);

      // Should NOT close yet
      expect(onClose).not.toHaveBeenCalled();

      // Now wait for protection period to expire
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      // Click backdrop again
      fireEvent.click(dialog);

      // Now it should close
      expect(onClose).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should reset protection period when dialog is reopened', async () => {
      vi.useFakeTimers();
      const onClose = vi.fn();
      const instances: MockCloseWatcher[] = [];

      // Capture the CloseWatcher instance when it's created using a spy
      const originalMock = MockCloseWatcher;
      vi.spyOn(window, 'CloseWatcher').mockImplementation(function (this: MockCloseWatcher) {
        const instance = new originalMock();
        instances.push(instance);
        return instance;
      } as unknown as () => CloseWatcher);

      const { rerender } = render(
        <Dialog isOpen={true} onClose={onClose}>
          <p>Dialog content</p>
        </Dialog>
      );

      // Wait for protection period to expire
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      // Close the dialog
      rerender(
        <Dialog isOpen={false} onClose={onClose}>
          <p>Dialog content</p>
        </Dialog>
      );

      // Wait for close animation
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // Reopen the dialog
      rerender(
        <Dialog isOpen={true} onClose={onClose}>
          <p>Dialog content</p>
        </Dialog>
      );

      // Try immediate close (should be protected again)
      await act(async () => {
        vi.advanceTimersByTime(50);
      });

      // Get the most recent CloseWatcher instance (created on reopen)
      const closeWatcherInstance = instances[instances.length - 1];
      if (closeWatcherInstance) {
        act(() => {
          closeWatcherInstance.close();
        });
      }

      // Should NOT close due to new protection period
      expect(onClose).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('close button', () => {
    it('should show close button by default', () => {
      render(
        <Dialog isOpen={true} onClose={() => {}}>
          <p>Dialog content</p>
        </Dialog>
      );

      expect(screen.getByRole('button', { name: /close/i })).toBeTruthy();
    });

    it('should hide close button when showCloseButton is false', () => {
      render(
        <Dialog isOpen={true} onClose={() => {}} showCloseButton={false}>
          <p>Dialog content</p>
        </Dialog>
      );

      expect(screen.queryByRole('button', { name: /close/i })).toBeNull();
    });
  });
});
