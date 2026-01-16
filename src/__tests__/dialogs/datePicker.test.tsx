/**
 * DatePicker Tests
 *
 * Tests for the DatePicker component, especially the disableHistoryManagement prop.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatePicker } from '../../components/Library/DatePicker';

describe('DatePicker', () => {
  let originalPushState: typeof window.history.pushState;
  let originalBack: typeof window.history.back;
  let pushStateMock: Mock;
  let backMock: Mock;

  beforeEach(() => {
    // Store original methods
    originalPushState = window.history.pushState;
    originalBack = window.history.back;

    // Mock history methods
    pushStateMock = vi.fn();
    backMock = vi.fn();
    window.history.pushState = pushStateMock;
    window.history.back = backMock;
  });

  afterEach(() => {
    // Restore original methods
    window.history.pushState = originalPushState;
    window.history.back = originalBack;
    vi.restoreAllMocks();
  });

  describe('history management', () => {
    it('should push history entry when opened (default behavior)', () => {
      const onChange = vi.fn();
      const testDate = new Date(2024, 0, 15);

      render(<DatePicker value={testDate} onChange={onChange} />);

      // Open the datepicker
      const trigger = screen.getByRole('button', { expanded: false });
      fireEvent.click(trigger);

      expect(pushStateMock).toHaveBeenCalledWith({ type: 'datepicker' }, '');
    });

    it('should NOT push history entry when disableHistoryManagement is true', () => {
      const onChange = vi.fn();
      const testDate = new Date(2024, 0, 15);

      render(
        <DatePicker
          value={testDate}
          onChange={onChange}
          disableHistoryManagement
        />
      );

      // Open the datepicker
      const trigger = screen.getByRole('button', { expanded: false });
      fireEvent.click(trigger);

      expect(pushStateMock).not.toHaveBeenCalled();
    });

    it('should NOT call history.back when closing with disableHistoryManagement', () => {
      const onChange = vi.fn();
      const testDate = new Date(2024, 0, 15);

      render(
        <DatePicker
          value={testDate}
          onChange={onChange}
          disableHistoryManagement
        />
      );

      // Open the datepicker
      const trigger = screen.getByRole('button', { expanded: false });
      fireEvent.click(trigger);

      // Select a date to close (find today's date button if available, or any available date)
      const availableDays = screen.getAllByRole('button').filter(
        btn => btn.className.includes('datepicker__day') && !btn.className.includes('disabled')
      );

      if (availableDays.length > 0) {
        fireEvent.click(availableDays[0]);
        expect(backMock).not.toHaveBeenCalled();
      }
    });
  });

  describe('date selection', () => {
    it('should call onChange when a date is selected', () => {
      const onChange = vi.fn();
      const testDate = new Date(2024, 0, 15);

      render(
        <DatePicker
          value={testDate}
          onChange={onChange}
          disableHistoryManagement
        />
      );

      // Open the datepicker
      const trigger = screen.getByRole('button', { expanded: false });
      fireEvent.click(trigger);

      // Find and click an available date
      const availableDays = screen.getAllByRole('button').filter(
        btn =>
          btn.className.includes('datepicker__day') &&
          !btn.className.includes('disabled') &&
          !btn.className.includes('empty')
      );

      if (availableDays.length > 0) {
        fireEvent.click(availableDays[0]);
        expect(onChange).toHaveBeenCalled();
      }
    });

    it('should close the dropdown after selecting a date', () => {
      const onChange = vi.fn();
      const testDate = new Date(2024, 0, 15);

      render(
        <DatePicker
          value={testDate}
          onChange={onChange}
          disableHistoryManagement
        />
      );

      // Open the datepicker
      const trigger = screen.getByRole('button', { expanded: false });
      fireEvent.click(trigger);

      // Should be open
      expect(screen.getByRole('dialog')).toBeTruthy();

      // Find and click an available date
      const availableDays = screen.getAllByRole('button').filter(
        btn =>
          btn.className.includes('datepicker__day') &&
          !btn.className.includes('disabled') &&
          !btn.className.includes('empty')
      );

      if (availableDays.length > 0) {
        fireEvent.click(availableDays[0]);
        // Dropdown should be closed (no dialog present)
        expect(screen.queryByRole('dialog')).toBeNull();
      }
    });
  });

  describe('keyboard navigation', () => {
    it('should toggle open state when trigger is clicked', () => {
      const onChange = vi.fn();
      const testDate = new Date(2024, 0, 15);

      render(
        <DatePicker
          value={testDate}
          onChange={onChange}
          disableHistoryManagement
        />
      );

      const trigger = screen.getByRole('button', { expanded: false });

      // Open
      fireEvent.click(trigger);
      expect(screen.getByRole('dialog')).toBeTruthy();

      // Close
      fireEvent.click(trigger);
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
