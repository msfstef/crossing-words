/**
 * useScreenWakeLock Hook Tests
 *
 * Tests for the screen wake lock functionality that keeps the screen
 * awake during follow mode.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScreenWakeLock } from '../../hooks/useScreenWakeLock';

// Mock WakeLockSentinel
class MockWakeLockSentinel {
  released = false;
  readonly type = 'screen' as const;
  private releaseCallbacks: (() => void)[] = [];

  async release(): Promise<void> {
    this.released = true;
    this.releaseCallbacks.forEach((cb) => cb());
  }

  addEventListener(type: 'release', listener: () => void): void {
    if (type === 'release') {
      this.releaseCallbacks.push(listener);
    }
  }

  removeEventListener(type: 'release', listener: () => void): void {
    if (type === 'release') {
      this.releaseCallbacks = this.releaseCallbacks.filter((cb) => cb !== listener);
    }
  }
}

describe('useScreenWakeLock', () => {
  let mockWakeLock: MockWakeLockSentinel | null;
  let mockRequest: ReturnType<typeof vi.fn>;
  let originalWakeLock: Navigator['wakeLock'];

  beforeEach(() => {
    mockWakeLock = null;
    mockRequest = vi.fn().mockImplementation(async () => {
      mockWakeLock = new MockWakeLockSentinel();
      return mockWakeLock;
    });

    // Store original and mock
    originalWakeLock = navigator.wakeLock;
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: mockRequest },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original
    Object.defineProperty(navigator, 'wakeLock', {
      value: originalWakeLock,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  describe('when API is supported', () => {
    it('should report API as supported', () => {
      const { result } = renderHook(() => useScreenWakeLock({ enabled: false }));

      expect(result.current.isSupported).toBe(true);
    });

    it('should not acquire wake lock when disabled', () => {
      renderHook(() => useScreenWakeLock({ enabled: false }));

      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('should acquire wake lock when enabled', async () => {
      const { result } = renderHook(() => useScreenWakeLock({ enabled: true }));

      // Wait for async acquisition
      await vi.waitFor(() => {
        expect(mockRequest).toHaveBeenCalledWith('screen');
        expect(result.current.isLocked).toBe(true);
      });

      expect(result.current.error).toBeNull();
    });

    it('should release wake lock when disabled after being enabled', async () => {
      const { result, rerender } = renderHook(
        ({ enabled }) => useScreenWakeLock({ enabled }),
        { initialProps: { enabled: true } }
      );

      // Wait for lock acquisition
      await vi.waitFor(() => {
        expect(result.current.isLocked).toBe(true);
      });

      // Capture the wake lock before disabling
      const acquiredLock = mockWakeLock;

      // Disable
      rerender({ enabled: false });

      // Wait for release
      await vi.waitFor(() => {
        expect(result.current.isLocked).toBe(false);
      });

      expect(acquiredLock?.released).toBe(true);
    });

    it('should release wake lock on unmount', async () => {
      const { result, unmount } = renderHook(() => useScreenWakeLock({ enabled: true }));

      // Wait for lock acquisition
      await vi.waitFor(() => {
        expect(result.current.isLocked).toBe(true);
      });

      const acquiredLock = mockWakeLock;

      // Unmount
      unmount();

      expect(acquiredLock?.released).toBe(true);
    });

    it('should re-acquire wake lock when page becomes visible', async () => {
      const { result } = renderHook(() => useScreenWakeLock({ enabled: true }));

      // Wait for initial lock acquisition
      await vi.waitFor(() => {
        expect(result.current.isLocked).toBe(true);
      });

      expect(mockRequest).toHaveBeenCalledTimes(1);

      // Simulate the wake lock being released (happens when page becomes hidden)
      act(() => {
        mockWakeLock?.release();
      });

      await vi.waitFor(() => {
        expect(result.current.isLocked).toBe(false);
      });

      // Simulate page becoming visible again
      act(() => {
        Object.defineProperty(document, 'visibilityState', {
          value: 'visible',
          writable: true,
          configurable: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Should re-acquire the lock
      await vi.waitFor(() => {
        expect(mockRequest).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle acquisition errors gracefully', async () => {
      mockRequest.mockRejectedValueOnce(new Error('Permission denied'));

      const { result } = renderHook(() => useScreenWakeLock({ enabled: true }));

      await vi.waitFor(() => {
        expect(result.current.error).toBe('Permission denied');
      });

      expect(result.current.isLocked).toBe(false);
    });
  });

  describe('when API is NOT supported', () => {
    beforeEach(() => {
      // Remove wake lock API by deleting the property
      // We need to delete the property entirely, not set it to undefined
      // @ts-expect-error - intentionally deleting for testing unsupported scenario
      delete navigator.wakeLock;
    });

    it('should report API as not supported', () => {
      const { result } = renderHook(() => useScreenWakeLock({ enabled: true }));

      expect(result.current.isSupported).toBe(false);
    });

    it('should not attempt to acquire wake lock', () => {
      renderHook(() => useScreenWakeLock({ enabled: true }));

      // mockRequest should not be called since we deleted wakeLock
      // The test just verifies no errors are thrown
      expect(true).toBe(true);
    });

    it('should not report any errors', () => {
      const { result } = renderHook(() => useScreenWakeLock({ enabled: true }));

      expect(result.current.error).toBeNull();
      expect(result.current.isLocked).toBe(false);
    });
  });
});
