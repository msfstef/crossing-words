import { useState } from 'react';
import { PUZZLE_SOURCES } from '../../services/puzzleSources/sources';
import { DatePicker } from './DatePicker';
import { Dialog } from '../Dialog';
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
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return today;
  });

  const selectedSource = PUZZLE_SOURCES.find((s) => s.id === sourceId);

  const handleDownload = () => {
    if (!selectedSource || !selectedDate) return;
    onDownload(sourceId, selectedSource.name, selectedDate);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      className="download-dialog"
      dialogId="download"
      showCloseButton={false}
    >
      <h2 className="download-dialog__title">Download Puzzle</h2>

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
          <label className="download-dialog__label">Date</label>
          <DatePicker
            value={selectedDate}
            onChange={setSelectedDate}
            availableDays={selectedSource?.availableDays}
            disableHistoryManagement
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
          disabled={!sourceId || !selectedDate}
        >
          Download
        </button>
      </div>
    </Dialog>
  );
}
