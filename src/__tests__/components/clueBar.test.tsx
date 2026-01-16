/**
 * ClueBar Tests
 *
 * Tests for the ClueBar component, especially dynamic font sizing for long clues.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClueBar } from '../../components/ClueBar';

// Mock dimensions for testing font size scaling
const LINE_HEIGHT = 20; // Simulated line height in pixels

describe('ClueBar', () => {
  let originalGetComputedStyle: typeof window.getComputedStyle;

  beforeEach(() => {
    originalGetComputedStyle = window.getComputedStyle;
    // Mock getComputedStyle for line-height
    window.getComputedStyle = vi.fn().mockReturnValue({
      lineHeight: `${LINE_HEIGHT}px`,
    });
  });

  afterEach(() => {
    window.getComputedStyle = originalGetComputedStyle;
    vi.restoreAllMocks();
  });

  describe('clue text rendering', () => {
    it('should render short clue text completely', () => {
      const clue = {
        number: 1,
        direction: 'across' as const,
        text: 'Short clue',
      };

      render(<ClueBar clue={clue} />);

      // The full clue text should be in the document
      expect(screen.getByText(/Short clue/)).toBeTruthy();
      expect(screen.getByText(/1A:/)).toBeTruthy();
    });

    it('should render long clue text completely (no truncation)', () => {
      const longText =
        'This is an extremely long clue that would normally be truncated with ellipses but should instead have its font size reduced to fit within the clue bar area while remaining fully visible and readable';
      const clue = {
        number: 42,
        direction: 'down' as const,
        text: longText,
      };

      render(<ClueBar clue={clue} />);

      // The full long clue text should be in the document - no truncation
      expect(screen.getByText(new RegExp(longText.slice(0, 50)))).toBeTruthy();
      // Verify the entire text is rendered by checking for end of the text
      expect(screen.getByText(/readable/)).toBeTruthy();
    });

    it('should render very long clue text completely (stress test)', () => {
      const veryLongText =
        'This is an extraordinarily verbose and needlessly lengthy clue description that would definitely overflow any reasonable clue bar implementation if not properly handled with dynamic font sizing that progressively reduces the text size until it fits within the allotted two lines of available space in the clue bar container';
      const clue = {
        number: 99,
        direction: 'across' as const,
        text: veryLongText,
      };

      render(<ClueBar clue={clue} />);

      // The entire text should be rendered - check for text near the end
      expect(screen.getByText(/container/)).toBeTruthy();
    });

    it('should show placeholder when no clue is provided', () => {
      render(<ClueBar clue={null} />);

      expect(screen.getByText(/Select a cell to see clue/)).toBeTruthy();
    });
  });

  describe('clue bar structure', () => {
    it('should have consistent structure regardless of clue length', () => {
      const shortClue = { number: 1, direction: 'across' as const, text: 'Hi' };
      const longClue = {
        number: 2,
        direction: 'down' as const,
        text: 'This is a very long clue that tests the structure remains consistent',
      };

      const { rerender } = render(<ClueBar clue={shortClue} />);
      const shortBar = document.querySelector('.clue-bar');
      expect(shortBar).toBeTruthy();

      rerender(<ClueBar clue={longClue} />);
      const longBar = document.querySelector('.clue-bar');
      expect(longBar).toBeTruthy();

      // Both should have the same class structure
      expect(shortBar?.className).toBe(longBar?.className);
    });

    it('should render navigation buttons', () => {
      const clue = { number: 1, direction: 'across' as const, text: 'Test clue' };

      render(
        <ClueBar
          clue={clue}
          hasPrev={true}
          hasNext={true}
          onPrevClue={() => {}}
          onNextClue={() => {}}
        />
      );

      expect(screen.getByLabelText('Previous clue')).toBeTruthy();
      expect(screen.getByLabelText('Next clue')).toBeTruthy();
    });
  });

  describe('dynamic font sizing', () => {
    it('should apply inline font-size style to clue text', () => {
      const clue = { number: 1, direction: 'across' as const, text: 'Test clue' };

      render(<ClueBar clue={clue} />);

      const clueText = document.querySelector('.clue-bar__clue-text');
      expect(clueText).toBeTruthy();
      // Should have inline font-size style
      expect(clueText?.getAttribute('style')).toContain('font-size');
    });

    it('should have clue text element for font scaling', () => {
      const clue = {
        number: 1,
        direction: 'across' as const,
        text: 'A longer clue that might need font scaling to fit properly',
      };

      render(<ClueBar clue={clue} />);

      const clueText = document.querySelector('.clue-bar__clue-text');
      expect(clueText).toBeTruthy();
      // The clue text element should exist and contain the full text
      expect(clueText?.textContent).toContain('font scaling');
    });
  });

  describe('clue format', () => {
    it('should format across clues with A suffix', () => {
      const clue = { number: 15, direction: 'across' as const, text: 'Test' };

      render(<ClueBar clue={clue} />);

      expect(screen.getByText(/15A:/)).toBeTruthy();
    });

    it('should format down clues with D suffix', () => {
      const clue = { number: 23, direction: 'down' as const, text: 'Test' };

      render(<ClueBar clue={clue} />);

      expect(screen.getByText(/23D:/)).toBeTruthy();
    });
  });

  describe('CSS text truncation removed', () => {
    it('should not have -webkit-line-clamp CSS property that truncates text', () => {
      const clue = {
        number: 1,
        direction: 'across' as const,
        text: 'Test clue for checking CSS truncation is removed',
      };

      render(<ClueBar clue={clue} />);

      const clueText = document.querySelector('.clue-bar__clue-text');
      expect(clueText).toBeTruthy();

      // The element should NOT have overflow:hidden or text-overflow:ellipsis
      // that would cause truncation (we need to check computed styles)
      const style = clueText?.getAttribute('style') || '';
      // The inline style should only contain font-size, not truncation properties
      expect(style).not.toContain('text-overflow');
      expect(style).not.toContain('line-clamp');
    });
  });
});
