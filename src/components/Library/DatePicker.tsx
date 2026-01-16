import { useState, useRef, useEffect, useCallback } from 'react';
import './DatePicker.css';

/**
 * Check if the browser supports CloseWatcher API.
 */
function supportsCloseWatcher(): boolean {
  return typeof window !== 'undefined' && 'CloseWatcher' in window;
}

// Note: CloseWatcher type is already declared globally in Dialog.tsx

type AvailableDays =
  | 'daily'
  | 'weekdays'
  | 'weekdays-only'
  | 'sunday-only'
  | 'thursday-only';

interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  availableDays?: AvailableDays;
  maxDate?: Date;
  minDate?: Date;
  /** When true, disables history management (for use inside dialogs that manage their own history) */
  disableHistoryManagement?: boolean;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function isDayAvailable(date: Date, availableDays: AvailableDays): boolean {
  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  switch (availableDays) {
    case 'daily':
      return true;
    case 'sunday-only':
      return dayOfWeek === 0;
    case 'thursday-only':
      return dayOfWeek === 4;
    case 'weekdays-only': // Mon-Sat (no Sunday)
      return dayOfWeek >= 1 && dayOfWeek <= 6;
    case 'weekdays': // Mon-Fri
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    default:
      return true;
  }
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function DatePicker({
  value,
  onChange,
  availableDays = 'daily',
  maxDate = new Date(),
  minDate,
  disableHistoryManagement = false,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => value || new Date());
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Track if we have a history entry for the datepicker (only used when CloseWatcher not available)
  const hasHistoryEntryRef = useRef(false);
  const closeWatcherRef = useRef<CloseWatcher | null>(null);

  // Close the datepicker and optionally clean up history
  const closeDatePicker = useCallback((viaBackButton: boolean = false) => {
    setIsOpen(false);
    // Only call history.back() if we have an entry and weren't closed by back button
    // Skip history management entirely if disabled or using CloseWatcher
    if (!disableHistoryManagement && !supportsCloseWatcher() && hasHistoryEntryRef.current && !viaBackButton) {
      hasHistoryEntryRef.current = false;
      window.history.back();
    } else {
      hasHistoryEntryRef.current = false;
    }
  }, [disableHistoryManagement]);

  // Set up CloseWatcher for Android back button support (when enabled)
  useEffect(() => {
    if (disableHistoryManagement || !isOpen) return;

    if (supportsCloseWatcher()) {
      try {
        const watcher = new CloseWatcher();
        closeWatcherRef.current = watcher;

        watcher.onclose = () => {
          closeDatePicker(true);
        };

        return () => {
          watcher.destroy();
          closeWatcherRef.current = null;
        };
      } catch {
        // CloseWatcher creation can fail if not triggered by user activation
        // Fall through to history-based handling
      }
    }
  }, [isOpen, disableHistoryManagement, closeDatePicker]);

  // Fallback: Handle back button to close datepicker (only if history management is enabled and CloseWatcher not available)
  useEffect(() => {
    if (disableHistoryManagement || supportsCloseWatcher()) return;

    const handlePopstate = () => {
      if (hasHistoryEntryRef.current) {
        closeDatePicker(true);
      }
    };

    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, [closeDatePicker, disableHistoryManagement]);

  // Push history entry when datepicker opens (only if history management is enabled and CloseWatcher not available)
  useEffect(() => {
    if (!disableHistoryManagement && !supportsCloseWatcher() && isOpen && !hasHistoryEntryRef.current) {
      window.history.pushState({ type: 'datepicker' }, '');
      hasHistoryEntryRef.current = true;
    }
  }, [isOpen, disableHistoryManagement]);

  const today = new Date();
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayOfMonth = getFirstDayOfMonth(viewYear, viewMonth);

  // Calculate dropdown position based on available viewport space
  // Uses fixed positioning to escape dialog overflow constraints
  const [dropdownPosition, setDropdownPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
  } | null>(null);
  // Track if position has been calculated (to show dropdown only after positioning)
  const [positionReady, setPositionReady] = useState(false);

  // Reset position ready state when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setPositionReady(false);
      setDropdownPosition(null);
      setOpenUpward(false);
    }
  }, [isOpen]);

  // Callback ref to position the dropdown when it mounts
  const positionDropdown = useCallback((node: HTMLDivElement | null) => {
    // Also store the ref for other uses
    (dropdownRef as React.MutableRefObject<HTMLDivElement | null>).current = node;

    if (!node || !containerRef.current || positionReady) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    // Set width first so we can measure height
    node.style.width = `${containerRect.width}px`;
    node.style.left = `${containerRect.left}px`;
    node.style.top = '-9999px';

    // Use setTimeout(0) to let the browser calculate layout
    setTimeout(() => {
      if (!containerRef.current) return;

      const dropdownHeight = node.offsetHeight;

      // Space below the trigger button
      const spaceBelow = window.innerHeight - containerRect.bottom;
      // Space above the trigger button
      const spaceAbove = containerRect.top;

      // Add some padding to account for margins
      const padding = 16;

      // Determine if dropdown fits in each direction
      const fitsBelow = spaceBelow >= dropdownHeight + padding;
      const fitsAbove = spaceAbove >= dropdownHeight + padding;

      // Decision logic:
      // 1. If fits below, open downward (default)
      // 2. If doesn't fit below but fits above, open upward
      // 3. If neither fits, open in direction with more space
      let shouldOpenUpward: boolean;
      if (fitsBelow) {
        shouldOpenUpward = false;
      } else if (fitsAbove) {
        shouldOpenUpward = true;
      } else {
        // Neither fits - choose direction with more space
        shouldOpenUpward = spaceAbove > spaceBelow;
      }

      setOpenUpward(shouldOpenUpward);

      // Calculate fixed position
      const gap = 6; // Gap between trigger and dropdown
      const minPadding = 8; // Minimum distance from viewport edge

      if (shouldOpenUpward) {
        // Calculate bottom position (distance from viewport bottom to trigger top)
        let bottom = window.innerHeight - containerRect.top + gap;

        // Check if dropdown would go off the top of the viewport
        // top = window.innerHeight - bottom - dropdownHeight
        const calculatedTop = window.innerHeight - bottom - dropdownHeight;
        if (calculatedTop < minPadding) {
          // Adjust bottom so top stays at minPadding
          bottom = window.innerHeight - minPadding - dropdownHeight;
        }

        setDropdownPosition({
          bottom,
          left: containerRect.left,
          width: containerRect.width,
        });
      } else {
        // Calculate top position
        let top = containerRect.bottom + gap;

        // Check if dropdown would go off the bottom of the viewport
        const calculatedBottom = top + dropdownHeight;
        if (calculatedBottom > window.innerHeight - minPadding) {
          // Adjust top so bottom stays at viewport - minPadding
          top = window.innerHeight - minPadding - dropdownHeight;
        }

        setDropdownPosition({
          top,
          left: containerRect.left,
          width: containerRect.width,
        });
      }

      // Mark position as ready to show the dropdown
      setPositionReady(true);
    }, 0);
  }, [positionReady]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeDatePicker();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, closeDatePicker]);

  // Update view when value changes externally
  useEffect(() => {
    if (value) {
      setViewDate(value);
    }
  }, [value]);

  const goToPrevMonth = () => {
    setViewDate(new Date(viewYear, viewMonth - 1, 1));
  };

  const goToNextMonth = () => {
    const nextMonth = new Date(viewYear, viewMonth + 1, 1);
    if (nextMonth <= maxDate) {
      setViewDate(nextMonth);
    }
  };

  const canGoNext = new Date(viewYear, viewMonth + 1, 1) <= maxDate;

  // Generate calendar days
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  const handleDayClick = (day: number) => {
    const selectedDate = new Date(viewYear, viewMonth, day, 12, 0, 0);
    const isAvailable = isDayAvailable(selectedDate, availableDays);
    const isInFuture = selectedDate > maxDate;
    const isBeforeMin = minDate && selectedDate < minDate;

    if (isAvailable && !isInFuture && !isBeforeMin) {
      onChange(selectedDate);
      closeDatePicker();
    }
  };

  const formatDisplayDate = (date: Date | null): string => {
    if (!date) return 'Select date';
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getAvailabilityHint = (): string => {
    switch (availableDays) {
      case 'sunday-only':
        return 'Sundays only';
      case 'thursday-only':
        return 'Thursdays only';
      case 'weekdays-only':
        return 'Mon\u2013Sat';
      case 'weekdays':
        return 'Mon\u2013Fri';
      default:
        return 'Daily';
    }
  };

  return (
    <div className="datepicker" ref={containerRef}>
      <button
        type="button"
        className={`datepicker__trigger ${isOpen ? 'datepicker__trigger--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span className="datepicker__trigger-text">
          {formatDisplayDate(value)}
        </span>
        <svg
          className="datepicker__trigger-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="16" y1="2" x2="16" y2="6" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={positionDropdown}
          className={`datepicker__dropdown datepicker__dropdown--fixed ${openUpward ? 'datepicker__dropdown--upward' : ''} ${!positionReady ? 'datepicker__dropdown--measuring' : ''}`}
          role="dialog"
          aria-modal="true"
          style={
            dropdownPosition
              ? {
                  top: dropdownPosition.top,
                  bottom: dropdownPosition.bottom,
                  left: dropdownPosition.left,
                  width: dropdownPosition.width,
                }
              : undefined
          }
        >
          <div className="datepicker__header">
            <button
              type="button"
              className="datepicker__nav-btn"
              onClick={goToPrevMonth}
              aria-label="Previous month"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="15,18 9,12 15,6" />
              </svg>
            </button>

            <div className="datepicker__month-year">
              <span className="datepicker__month">
                {MONTH_NAMES[viewMonth]}
              </span>
              <span className="datepicker__year">{viewYear}</span>
            </div>

            <button
              type="button"
              className="datepicker__nav-btn"
              onClick={goToNextMonth}
              disabled={!canGoNext}
              aria-label="Next month"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="9,6 15,12 9,18" />
              </svg>
            </button>
          </div>

          <div className="datepicker__availability">
            <span className="datepicker__availability-dot"></span>
            <span className="datepicker__availability-text">
              {getAvailabilityHint()}
            </span>
          </div>

          <div className="datepicker__weekdays">
            {DAY_NAMES.map((day) => (
              <div key={day} className="datepicker__weekday">
                {day}
              </div>
            ))}
          </div>

          <div className="datepicker__grid">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="datepicker__day datepicker__day--empty"
                  />
                );
              }

              const cellDate = new Date(viewYear, viewMonth, day, 12, 0, 0);
              const isAvailable = isDayAvailable(cellDate, availableDays);
              const isInFuture = cellDate > maxDate;
              const isBeforeMin = minDate && cellDate < minDate;
              const isDisabled = !isAvailable || isInFuture || isBeforeMin;
              const isToday = isSameDay(cellDate, today);
              const isSelected = value && isSameDay(cellDate, value);

              let className = 'datepicker__day';
              if (isDisabled) className += ' datepicker__day--disabled';
              if (isToday) className += ' datepicker__day--today';
              if (isSelected) className += ' datepicker__day--selected';
              if (!isAvailable && !isInFuture)
                className += ' datepicker__day--blocked';

              return (
                <button
                  key={day}
                  type="button"
                  className={className}
                  onClick={() => handleDayClick(day)}
                  disabled={isDisabled}
                  aria-label={`${day} ${MONTH_NAMES[viewMonth]} ${viewYear}${isDisabled ? ' (unavailable)' : ''}`}
                  aria-pressed={isSelected || undefined}
                >
                  <span className="datepicker__day-num">{day}</span>
                </button>
              );
            })}
          </div>

          <div className="datepicker__footer">
            <button
              type="button"
              className="datepicker__today-btn"
              onClick={() => {
                const todayDate = new Date();
                todayDate.setHours(12, 0, 0, 0);
                if (isDayAvailable(todayDate, availableDays)) {
                  onChange(todayDate);
                  closeDatePicker();
                } else {
                  setViewDate(todayDate);
                }
              }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
