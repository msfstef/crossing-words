import { useState, useRef, useEffect } from 'react';
import './FAB.css';

interface FABProps {
  onDownloadClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

/**
 * Floating Action Button that expands vertically to show Import and Download options.
 * Used in the library view to replace header action buttons on mobile.
 */
export function FAB({ onDownloadClick, fileInputRef }: FABProps) {
  const [expanded, setExpanded] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  // Close FAB when clicking outside
  useEffect(() => {
    if (!expanded) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };

    // Delay to avoid immediate close on the same click that opened it
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [expanded]);

  const handleMainClick = () => {
    setExpanded(!expanded);
  };

  const handleImportClick = () => {
    setExpanded(false);
    fileInputRef.current?.click();
  };

  const handleDownloadClick = () => {
    setExpanded(false);
    onDownloadClick();
  };

  return (
    <div className={`fab ${expanded ? 'fab--expanded' : ''}`} ref={fabRef}>
      {/* Expanded options */}
      <div className="fab__options">
        <button
          type="button"
          className="fab__option"
          onClick={handleDownloadClick}
          aria-label="Download puzzle"
        >
          <svg
            className="fab__option-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span className="fab__option-label">Download</span>
        </button>
        <button
          type="button"
          className="fab__option"
          onClick={handleImportClick}
          aria-label="Import puzzle file"
        >
          <svg
            className="fab__option-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <span className="fab__option-label">Import</span>
        </button>
      </div>

      {/* Main FAB button */}
      <button
        type="button"
        className="fab__main"
        onClick={handleMainClick}
        aria-label={expanded ? 'Close menu' : 'Open menu'}
        aria-expanded={expanded}
      >
        <svg
          className="fab__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
