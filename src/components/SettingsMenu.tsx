import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTheme, type Theme } from '../hooks/useTheme';
import './SettingsMenu.css';

// Long press duration in ms
const LONG_PRESS_DURATION = 600;

/**
 * Hook for long-press interaction on touch devices.
 * Returns handlers and progress state for the filling animation.
 */
function useLongPress(onComplete: () => void, duration = LONG_PRESS_DURATION) {
  const [progress, setProgress] = useState(0);
  const [isPressed, setIsPressed] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const frameRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  // Check if device is touch-only (coarse pointer + no hover = phones/tablets)
  // This excludes touchscreen laptops that also have mouse/trackpad
  const isTouchDevice = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse) and (hover: none)').matches,
    []
  );

  // Use ref to hold latest callback to avoid stale closure in recursive animation frame
  const updateProgressRef = useRef<(() => void) | null>(null);

  const updateProgress = useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;
    const newProgress = Math.min(elapsed / duration, 1);
    setProgress(newProgress);

    if (newProgress < 1) {
      frameRef.current = requestAnimationFrame(() => updateProgressRef.current?.());
    } else if (!completedRef.current) {
      completedRef.current = true;
      onComplete();
      // Reset state after completion so animation is fresh when menu reopens
      setProgress(0);
      setIsPressed(false);
    }
  }, [duration, onComplete]);

  // Keep ref in sync with latest callback
  useEffect(() => {
    updateProgressRef.current = updateProgress;
  }, [updateProgress]);

  const startPress = useCallback(() => {
    if (!isTouchDevice) return;

    completedRef.current = false;
    setIsPressed(true);
    setProgress(0);
    startTimeRef.current = Date.now();
    frameRef.current = requestAnimationFrame(() => updateProgressRef.current?.());
  }, [isTouchDevice]);

  const endPress = useCallback(() => {
    if (!isTouchDevice) return;

    setIsPressed(false);
    setProgress(0);
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, [isTouchDevice]);

  const handleClick = useCallback(() => {
    // Only trigger on click for non-touch devices
    if (!isTouchDevice) {
      onComplete();
    }
  }, [onComplete, isTouchDevice]);

  // Cleanup on unmount
  useEffect(() => {
    const frame = frameRef.current;
    const timer = timerRef.current;
    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  return {
    progress,
    isPressed,
    isTouchDevice,
    handlers: {
      onTouchStart: startPress,
      onTouchEnd: endPress,
      onTouchCancel: endPress,
      onMouseDown: startPress,
      onMouseUp: endPress,
      onMouseLeave: endPress,
      onClick: handleClick,
    },
  };
}

interface SettingsMenuProps {
  onCheckLetter?: () => void;
  onCheckWord?: () => void;
  onCheckPuzzle?: () => void;
  onRevealLetter?: () => void;
  onRevealWord?: () => void;
  onRevealPuzzle?: () => void;
  autoCheckEnabled?: boolean;
  onAutoCheckToggle?: () => void;
  /** Reset puzzle (clear all entries) */
  onReset?: () => void;
  /** Whether zoom mode is active */
  isZoomMode?: boolean;
  /** Toggle zoom mode */
  onToggleZoom?: () => void;
}

/**
 * Consolidated settings menu with Check, Reveal, Auto-check, and Theme controls.
 * Follows the same dropdown pattern as Toolbar.
 */
export function SettingsMenu({
  onCheckLetter,
  onCheckWord,
  onCheckPuzzle,
  onRevealLetter,
  onRevealWord,
  onRevealPuzzle,
  autoCheckEnabled = false,
  onAutoCheckToggle,
  onReset,
  isZoomMode = false,
  onToggleZoom,
}: SettingsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  // Long-press handler for reset button
  const handleReset = useCallback(() => {
    if (onReset) {
      onReset();
      setMenuOpen(false);
    }
  }, [onReset]);

  const { progress, isPressed, isTouchDevice, handlers: longPressHandlers } = useLongPress(handleReset);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  const handleAction = (action?: () => void) => {
    if (action) {
      action();
    }
    setMenuOpen(false);
  };

  // Check if puzzle actions are available
  const hasPuzzleActions = onCheckLetter || onCheckWord || onCheckPuzzle;

  return (
    <div className="settings-menu" ref={menuRef}>
      <button
        className="settings-menu__button"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-expanded={menuOpen}
        aria-haspopup="true"
        aria-label="Settings"
        title="Settings"
      >
        ⚙
      </button>
      {menuOpen && (
        <div className="settings-menu__dropdown" role="menu">
          {/* Reveal section */}
          {hasPuzzleActions && (
            <div className="settings-menu__section">
              <span className="settings-menu__label">Reveal</span>
              <div className="settings-menu__button-row">
                <button
                  className="settings-menu__action-btn"
                  onClick={() => handleAction(onRevealLetter)}
                  data-testid="reveal-letter"
                >
                  Letter
                </button>
                <button
                  className="settings-menu__action-btn"
                  onClick={() => handleAction(onRevealWord)}
                  data-testid="reveal-word"
                >
                  Word
                </button>
                <button
                  className="settings-menu__action-btn"
                  onClick={() => handleAction(onRevealPuzzle)}
                  data-testid="reveal-puzzle"
                >
                  Puzzle
                </button>
              </div>
            </div>
          )}

          {/* Check section */}
          {hasPuzzleActions && (
            <div className="settings-menu__section">
              <span className="settings-menu__label">Check</span>
              <div className="settings-menu__button-row">
                <button
                  className="settings-menu__action-btn"
                  onClick={() => handleAction(onCheckLetter)}
                  data-testid="check-letter"
                >
                  Letter
                </button>
                <button
                  className="settings-menu__action-btn"
                  onClick={() => handleAction(onCheckWord)}
                  data-testid="check-word"
                >
                  Word
                </button>
                <button
                  className="settings-menu__action-btn"
                  onClick={() => handleAction(onCheckPuzzle)}
                  data-testid="check-puzzle"
                >
                  Puzzle
                </button>
              </div>
            </div>
          )}

          {/* Auto-check toggle */}
          {onAutoCheckToggle && (
            <div className="settings-menu__section">
              <label className="settings-menu__toggle-row">
                <span className="settings-menu__toggle-label">Auto-check</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoCheckEnabled}
                  className={`settings-menu__toggle ${autoCheckEnabled ? 'settings-menu__toggle--active' : ''}`}
                  onClick={() => {
                    onAutoCheckToggle();
                  }}
                  data-testid="auto-check-toggle"
                >
                  <span className="settings-menu__toggle-track" />
                  <span className="settings-menu__toggle-knob" />
                </button>
              </label>
            </div>
          )}

          {/* Reset button */}
          {onReset && (
            <div className="settings-menu__section">
              <div className="settings-menu__reset-row">
                <span className="settings-menu__reset-label">
                  Reset{isTouchDevice && <span className="settings-menu__reset-hint"> (hold)</span>}
                </span>
                <button
                  type="button"
                  className={`settings-menu__reset-btn ${isPressed ? 'settings-menu__reset-btn--pressing' : ''}`}
                  data-testid="reset-puzzle"
                  {...longPressHandlers}
                >
                  <span
                    className="settings-menu__reset-fill"
                    style={{ transform: `scaleX(${progress})` }}
                  />
                  <span className="settings-menu__reset-text">Clear</span>
                </button>
              </div>
            </div>
          )}

          {/* Divider before view/theme */}
          {hasPuzzleActions && <div className="settings-menu__divider" />}

          {/* View Mode (Zoom toggle) */}
          {onToggleZoom && (
            <div className="settings-menu__section">
              <span className="settings-menu__label">View</span>
              <div className="settings-menu__segmented" role="radiogroup">
                <button
                  role="radio"
                  aria-checked={!isZoomMode}
                  className={`settings-menu__segment ${!isZoomMode ? 'settings-menu__segment--active' : ''}`}
                  onClick={isZoomMode ? onToggleZoom : undefined}
                  data-testid="zoom-toggle-full"
                >
                  Full
                </button>
                <button
                  role="radio"
                  aria-checked={isZoomMode}
                  className={`settings-menu__segment ${isZoomMode ? 'settings-menu__segment--active' : ''}`}
                  onClick={!isZoomMode ? onToggleZoom : undefined}
                  data-testid="zoom-toggle-zoom"
                >
                  Zoom
                </button>
              </div>
            </div>
          )}

          {/* Theme section */}
          <div className="settings-menu__section">
            <span className="settings-menu__label">Theme</span>
            <div className="settings-menu__options" role="radiogroup">
              <button
                role="radio"
                aria-checked={theme === 'light'}
                className={`settings-menu__option ${theme === 'light' ? 'settings-menu__option--active' : ''}`}
                onClick={() => handleThemeChange('light')}
              >
                ☀️ Light
              </button>
              <button
                role="radio"
                aria-checked={theme === 'dark'}
                className={`settings-menu__option ${theme === 'dark' ? 'settings-menu__option--active' : ''}`}
                onClick={() => handleThemeChange('dark')}
              >
                🌙 Dark
              </button>
              <button
                role="radio"
                aria-checked={theme === 'system'}
                className={`settings-menu__option ${theme === 'system' ? 'settings-menu__option--active' : ''}`}
                onClick={() => handleThemeChange('system')}
              >
                💻 System
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
