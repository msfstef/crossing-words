import { useState, useRef, useEffect } from 'react';
import './Toolbar.css';

interface ToolbarProps {
  onCheckLetter: () => void;
  onCheckWord: () => void;
  onCheckPuzzle: () => void;
  onRevealLetter: () => void;
  onRevealWord: () => void;
  onRevealPuzzle: () => void;
  autoCheckEnabled: boolean;
  onAutoCheckToggle: () => void;
}

export function Toolbar({
  onCheckLetter, onCheckWord, onCheckPuzzle,
  onRevealLetter, onRevealWord, onRevealPuzzle,
  autoCheckEnabled, onAutoCheckToggle,
}: ToolbarProps) {
  const [checkMenuOpen, setCheckMenuOpen] = useState(false);
  const [revealMenuOpen, setRevealMenuOpen] = useState(false);
  const checkRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (checkRef.current && !checkRef.current.contains(event.target as Node)) {
        setCheckMenuOpen(false);
      }
      if (revealRef.current && !revealRef.current.contains(event.target as Node)) {
        setRevealMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="toolbar">
      <div className="toolbar-group" ref={checkRef}>
        <button
          className="toolbar-button"
          onClick={() => { setCheckMenuOpen(!checkMenuOpen); setRevealMenuOpen(false); }}
          aria-expanded={checkMenuOpen}
          aria-haspopup="true"
          data-testid="check-button"
        >
          Check ▾
        </button>
        {checkMenuOpen && (
          <div className="toolbar-menu" role="menu">
            <button
              role="menuitem"
              onClick={() => { onCheckLetter(); setCheckMenuOpen(false); }}
              data-testid="check-letter"
            >
              Letter
            </button>
            <button
              role="menuitem"
              onClick={() => { onCheckWord(); setCheckMenuOpen(false); }}
              data-testid="check-word"
            >
              Word
            </button>
            <button
              role="menuitem"
              onClick={() => { onCheckPuzzle(); setCheckMenuOpen(false); }}
              data-testid="check-puzzle"
            >
              Puzzle
            </button>
          </div>
        )}
      </div>

      <div className="toolbar-group" ref={revealRef}>
        <button
          className="toolbar-button"
          onClick={() => { setRevealMenuOpen(!revealMenuOpen); setCheckMenuOpen(false); }}
          aria-expanded={revealMenuOpen}
          aria-haspopup="true"
          data-testid="reveal-button"
        >
          Reveal ▾
        </button>
        {revealMenuOpen && (
          <div className="toolbar-menu" role="menu">
            <button
              role="menuitem"
              onClick={() => { onRevealLetter(); setRevealMenuOpen(false); }}
              data-testid="reveal-letter"
            >
              Letter
            </button>
            <button
              role="menuitem"
              onClick={() => { onRevealWord(); setRevealMenuOpen(false); }}
              data-testid="reveal-word"
            >
              Word
            </button>
            <button
              role="menuitem"
              onClick={() => { onRevealPuzzle(); setRevealMenuOpen(false); }}
              data-testid="reveal-puzzle"
            >
              Puzzle
            </button>
          </div>
        )}
      </div>

      <label className="toolbar-toggle" data-testid="auto-check-toggle">
        <input
          type="checkbox"
          checked={autoCheckEnabled}
          onChange={onAutoCheckToggle}
        />
        <span>Auto-check</span>
      </label>
    </div>
  );
}
