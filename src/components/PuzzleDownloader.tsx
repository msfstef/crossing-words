import { useState } from 'react';
import { PUZZLE_SOURCES } from '../services/puzzleSources/sources';
import { fetchPuzzle } from '../services/puzzleSources/fetchPuzzle';
import { importPuzzle } from '../lib/puzzleImport';
import type { Puzzle } from '../types/puzzle';
import './PuzzleDownloader.css';

interface PuzzleDownloaderProps {
  onPuzzleLoaded: (puzzle: Puzzle) => void;
  onError: (error: string) => void;
}

export function PuzzleDownloader({
  onPuzzleLoaded,
  onError,
}: PuzzleDownloaderProps) {
  const [sourceId, setSourceId] = useState(PUZZLE_SOURCES[0]?.id || '');
  const [date, setDate] = useState(() => {
    // Default to today in YYYY-MM-DD format for date input
    return new Date().toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!sourceId || !date) return;

    setLoading(true);
    try {
      const source = PUZZLE_SOURCES.find((s) => s.id === sourceId);
      if (!source) throw new Error('Invalid source');

      // Use noon to avoid timezone edge cases
      const puzzleDate = new Date(date + 'T12:00:00');
      const buffer = await fetchPuzzle(sourceId, puzzleDate);

      // Use existing importPuzzle with filename hint for format detection
      const puzzle = await importPuzzle(buffer, `puzzle.${source.format}`);
      onPuzzleLoaded(puzzle);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to download puzzle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="puzzle-downloader">
      <select
        value={sourceId}
        onChange={(e) => setSourceId(e.target.value)}
        className="puzzle-downloader__source"
        disabled={loading}
      >
        {PUZZLE_SOURCES.map((source) => (
          <option key={source.id} value={source.id}>
            {source.name}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="puzzle-downloader__date"
        disabled={loading}
        max={new Date().toISOString().split('T')[0]}
      />

      <button
        onClick={handleDownload}
        disabled={loading || !sourceId || !date}
        className="puzzle-downloader__button"
      >
        {loading ? 'Loading...' : 'Download'}
      </button>
    </div>
  );
}
