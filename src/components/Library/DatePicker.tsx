import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import './DatePicker.css';

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
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => value || new Date());
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDayOfMonth = getFirstDayOfMonth(viewYear, viewMonth);

  // Calculate dropdown direction based on available viewport space
  useLayoutEffect(() => {
    if (!isOpen || !containerRef.current || !dropdownRef.current) return;

    const container = containerRef.current;
    const dropdown = dropdownRef.current;
    const containerRect = container.getBoundingClientRect();
    const dropdownHeight = dropdown.offsetHeight;

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
    if (fitsBelow) {
      setOpenUpward(false);
    } else if (fitsAbove) {
      setOpenUpward(true);
    } else {
      // Neither fits - choose direction with more space
      setOpenUpward(spaceAbove > spaceBelow);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

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
      setIsOpen(false);
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
          ref={dropdownRef}
          className={`datepicker__dropdown ${openUpward ? 'datepicker__dropdown--upward' : ''}`}
          role="dialog"
          aria-modal="true"
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
                  setIsOpen(false);
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
