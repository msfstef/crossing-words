import { useState } from 'react';
import { PUZZLE_SOURCES } from '../../services/puzzleSources/sources';
import './DownloadDialog.css';

interface DownloadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDownload: (sourceId: string, sourceName: string, date: Date) => void;
}

/**
 * Modal dialog for selecting puzzle source and date for download.
 * Closes immediately on download start, letting LibraryView handle optimistic UI.
 */
export function DownloadDialog({ isOpen, onClose, onDownload }: DownloadDialogProps) {
  const [sourceId, setSourceId] = useState(PUZZLE_SOURCES[0]?.id || '');
  const [date, setDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  if (!isOpen) return null;

  const handleDownload = () => {
    const source = PUZZLE_SOURCES.find((s) => s.id === sourceId);
    if (!source || !date) return;

    // Use noon to avoid timezone edge cases
    const puzzleDate = new Date(date + 'T12:00:00');
    onDownload(sourceId, source.name, puzzleDate);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="download-dialog-backdrop" onClick={handleBackdropClick}>
      <div
        className="download-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-dialog-title"
      >
        <h2 id="download-dialog-title" className="download-dialog__title">
          Download Puzzle
        </h2>

        <div className="download-dialog__content">
          <div className="download-dialog__field">
            <label htmlFor="source-select" className="download-dialog__label">
              Source
            </label>
            <select
              id="source-select"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="download-dialog__select"
            >
              {PUZZLE_SOURCES.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </div>

          <div className="download-dialog__field">
            <label htmlFor="date-input" className="download-dialog__label">
              Date
            </label>
            <input
              id="date-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="download-dialog__date"
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>

        <div className="download-dialog__actions">
          <button
            type="button"
            className="download-dialog__button download-dialog__button--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="download-dialog__button download-dialog__button--primary"
            onClick={handleDownload}
            disabled={!sourceId || !date}
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
