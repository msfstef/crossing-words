import { useState, useRef, useEffect } from 'react';
import { useTheme, type Theme } from '../hooks/useTheme';
import './SettingsMenu.css';

interface SettingsMenuProps {
  onCheckLetter?: () => void;
  onCheckWord?: () => void;
  onCheckPuzzle?: () => void;
  onRevealLetter?: () => void;
  onRevealWord?: () => void;
  onRevealPuzzle?: () => void;
  autoCheckEnabled?: boolean;
  onAutoCheckToggle?: () => void;
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
  isZoomMode = false,
  onToggleZoom,
}: SettingsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

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

          {/* Divider before view/theme */}
          {hasPuzzleActions && <div className="settings-menu__divider" />}

          {/* View section */}
          {onToggleZoom && (
            <div className="settings-menu__section">
              <span className="settings-menu__label">View</span>
              <div className="settings-menu__options" role="radiogroup">
                <button
                  role="radio"
                  aria-checked={!isZoomMode}
                  className={`settings-menu__option ${!isZoomMode ? 'settings-menu__option--active' : ''}`}
                  onClick={() => {
                    if (isZoomMode) onToggleZoom();
                  }}
                >
                  🔲 Full Grid
                </button>
                <button
                  role="radio"
                  aria-checked={isZoomMode}
                  className={`settings-menu__option ${isZoomMode ? 'settings-menu__option--active' : ''}`}
                  onClick={() => {
                    if (!isZoomMode) onToggleZoom();
                  }}
                >
                  🔍 Zoom
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
