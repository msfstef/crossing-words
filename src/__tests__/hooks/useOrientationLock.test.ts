/**
 * useOrientationLock Hook Tests
 *
 * Tests for the orientation lock functionality that keeps phones in portrait mode.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOrientationLock } from '../../hooks/useOrientationLock';

describe('useOrientationLock', () => {
  let originalScreen: Screen;
  let mockLock: ReturnType<typeof vi.fn>;
  let mockUnlock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalScreen = window.screen;
    mockLock = vi.fn().mockResolvedValue(undefined);
    mockUnlock = vi.fn();
  });

  afterEach(() => {
    // Restore original screen
    Object.defineProperty(window, 'screen', {
      value: originalScreen,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  describe('on phone-sized devices', () => {
    beforeEach(() => {
      // Mock a phone-sized screen (e.g., iPhone 14)
      Object.defineProperty(window, 'screen', {
        value: {
          width: 390,
          height: 844,
          orientation: {
            lock: mockLock,
            unlock: mockUnlock,
            type: 'portrait-primary',
            angle: 0,
          },
        },
        writable: true,
        configurable: true,
      });

      // Mock touch capability
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 5,
        writable: true,
        configurable: true,
      });
    });

    it('should detect device as phone-sized', () => {
      const { result } = renderHook(() => useOrientationLock());
      expect(result.current.isPhoneDevice).toBe(true);
    });

    it('should report orientation API as supported', () => {
      const { result } = renderHook(() => useOrientationLock());
      expect(result.current.isSupported).toBe(true);
    });

    it('should attempt to lock orientation to portrait', async () => {
      renderHook(() => useOrientationLock());

      await vi.waitFor(() => {
        expect(mockLock).toHaveBeenCalledWith('portrait-primary');
      });
    });

    it('should handle lock failure gracefully', async () => {
      mockLock.mockRejectedValueOnce(new Error('Not allowed'));

      const { result } = renderHook(() => useOrientationLock());

      await vi.waitFor(() => {
        expect(mockLock).toHaveBeenCalled();
      });

      // Should not throw, just set isLocked to false
      expect(result.current.isLocked).toBe(false);
    });

    it('should set isLocked to true on successful lock', async () => {
      const { result } = renderHook(() => useOrientationLock());

      await vi.waitFor(() => {
        expect(result.current.isLocked).toBe(true);
      });
    });
  });

  describe('on tablet-sized devices', () => {
    beforeEach(() => {
      // Mock a tablet-sized screen (e.g., iPad)
      Object.defineProperty(window, 'screen', {
        value: {
          width: 1024,
          height: 1366,
          orientation: {
            lock: mockLock,
            unlock: mockUnlock,
            type: 'portrait-primary',
            angle: 0,
          },
        },
        writable: true,
        configurable: true,
      });

      // Mock touch capability
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 5,
        writable: true,
        configurable: true,
      });
    });

    it('should not detect device as phone-sized', () => {
      const { result } = renderHook(() => useOrientationLock());
      expect(result.current.isPhoneDevice).toBe(false);
    });

    it('should NOT attempt to lock orientation', async () => {
      renderHook(() => useOrientationLock());

      // Give it time to potentially call lock
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockLock).not.toHaveBeenCalled();
    });
  });

  describe('on desktop devices', () => {
    beforeEach(() => {
      // Mock a desktop screen
      Object.defineProperty(window, 'screen', {
        value: {
          width: 1920,
          height: 1080,
          orientation: {
            lock: mockLock,
            unlock: mockUnlock,
            type: 'landscape-primary',
            angle: 0,
          },
        },
        writable: true,
        configurable: true,
      });

      // Mock no touch capability
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 0,
        writable: true,
        configurable: true,
      });
    });

    it('should not detect device as phone-sized', () => {
      const { result } = renderHook(() => useOrientationLock());
      expect(result.current.isPhoneDevice).toBe(false);
    });

    it('should NOT attempt to lock orientation', async () => {
      renderHook(() => useOrientationLock());

      // Give it time to potentially call lock
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockLock).not.toHaveBeenCalled();
    });
  });

  describe('when Screen Orientation API is NOT supported', () => {
    beforeEach(() => {
      // Mock a phone-sized screen without orientation API
      Object.defineProperty(window, 'screen', {
        value: {
          width: 390,
          height: 844,
          // No orientation property
        },
        writable: true,
        configurable: true,
      });

      // Mock touch capability
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 5,
        writable: true,
        configurable: true,
      });
    });

    it('should report API as not supported', () => {
      const { result } = renderHook(() => useOrientationLock());
      expect(result.current.isSupported).toBe(false);
    });

    it('should still detect phone device', () => {
      const { result } = renderHook(() => useOrientationLock());
      expect(result.current.isPhoneDevice).toBe(true);
    });

    it('should not attempt any lock operations', async () => {
      renderHook(() => useOrientationLock());

      // Give it time to potentially call lock
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockLock).not.toHaveBeenCalled();
    });
  });
});
