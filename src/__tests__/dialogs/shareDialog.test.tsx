/**
 * ShareDialog Component Tests
 *
 * Tests for the ShareDialog component, especially mobile behavior
 * where the Copy Link button is hidden when native share is available.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShareDialog } from '../../components/ShareDialog';

// Mock clipboard API
const mockWriteText = vi.fn();

describe('ShareDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    shareUrl: 'https://example.com/#puzzle=test&timeline=abc',
    puzzleTitle: 'Test Puzzle',
  };

  beforeEach(() => {
    mockWriteText.mockResolvedValue(undefined);
    vi.clearAllMocks();

    // Mock clipboard API properly
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when native sharing is NOT available (desktop)', () => {
    beforeEach(() => {
      // Mock navigator.canShare to return false (desktop)
      Object.defineProperty(navigator, 'canShare', {
        value: () => false,
        configurable: true,
      });
    });

    it('should show Copy Link button', async () => {
      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /copy link/i })).toBeTruthy();
      });
    });

    it('should NOT show Share button', async () => {
      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /^share$/i })).toBeNull();
      });
    });

    it('should copy to clipboard when Copy Link is clicked', async () => {
      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /copy link/i })).toBeTruthy();
      });

      const copyButton = screen.getByRole('button', { name: /copy link/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(defaultProps.shareUrl);
      });
    });
  });

  describe('when native sharing IS available (mobile)', () => {
    beforeEach(() => {
      // Mock navigator.canShare to return true (mobile with share API)
      Object.defineProperty(navigator, 'canShare', {
        value: () => true,
        configurable: true,
      });
    });

    it('should NOT show Copy Link button', async () => {
      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        // Should see the Share button which confirms the capability check ran
        expect(screen.getByRole('button', { name: /^share$/i })).toBeTruthy();
      });

      // Copy Link button should be hidden on mobile
      expect(screen.queryByRole('button', { name: /copy link/i })).toBeNull();
    });

    it('should show Share button', async () => {
      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^share$/i })).toBeTruthy();
      });
    });

    it('should show tap hint below URL', async () => {
      render(<ShareDialog {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/tap to copy/i)).toBeTruthy();
      });
    });

    it('should copy to clipboard when URL input is clicked', async () => {
      render(<ShareDialog {...defaultProps} />);

      const urlInput = screen.getByLabelText(/share url/i);
      fireEvent.click(urlInput);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(defaultProps.shareUrl);
      });
    });

    it('should show feedback after copying via URL click', async () => {
      render(<ShareDialog {...defaultProps} />);

      // Wait for share capability to be detected
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^share$/i })).toBeTruthy();
      });

      const urlInput = screen.getByLabelText(/share url/i);
      fireEvent.click(urlInput);

      await waitFor(() => {
        expect(screen.getByText(/copied!/i)).toBeTruthy();
      });
    });
  });

  describe('URL input behavior', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'canShare', {
        value: () => false,
        configurable: true,
      });
    });

    it('should display the share URL', () => {
      render(<ShareDialog {...defaultProps} />);

      const urlInput = screen.getByLabelText(/share url/i) as HTMLInputElement;
      expect(urlInput.value).toBe(defaultProps.shareUrl);
    });

    it('should be readonly', () => {
      render(<ShareDialog {...defaultProps} />);

      const urlInput = screen.getByLabelText(/share url/i) as HTMLInputElement;
      expect(urlInput.readOnly).toBe(true);
    });

    it('should copy to clipboard when clicked', async () => {
      render(<ShareDialog {...defaultProps} />);

      const urlInput = screen.getByLabelText(/share url/i);
      fireEvent.click(urlInput);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith(defaultProps.shareUrl);
      });
    });
  });
});
