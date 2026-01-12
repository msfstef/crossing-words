import { useState, useRef, useEffect } from 'react';
import { useTheme, type Theme } from '../hooks/useTheme';
import './SettingsMenu.css';

/**
 * Settings menu with theme toggle.
 * Follows the same dropdown pattern as Toolbar.
 */
export function SettingsMenu() {
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
    setMenuOpen(false);
  };

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
