import { useState, useEffect, useCallback } from 'react';
import { PuzzleCard } from './PuzzleCard';
import { FilePicker } from '../FilePicker';
import { PuzzleDownloader } from '../PuzzleDownloader';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import {
  listAllPuzzles,
  deletePuzzle,
  getPuzzleProgress,
  loadPuzzleById,
  savePuzzle,
  type PuzzleEntry,
} from '../../lib/puzzleStorage';
import type { Puzzle } from '../../types/puzzle';
import './LibraryView.css';

interface PuzzleWithProgress extends PuzzleEntry {
  progress: { filled: number; total: number };
}

interface LibraryViewProps {
  onOpenPuzzle: (puzzle: Puzzle, puzzleId: string) => void;
  onError: (message: string) => void;
}

/**
 * Group puzzles by date (or savedAt date if no puzzle date).
 * Returns groups sorted by date (most recent first).
 */
function groupPuzzlesByDate(puzzles: PuzzleWithProgress[]): Map<string, PuzzleWithProgress[]> {
  const groups = new Map<string, PuzzleWithProgress[]>();

  for (const puzzle of puzzles) {
    // Use puzzle date if available, otherwise format savedAt
    const dateKey = puzzle.date ?? formatDate(new Date(puzzle.savedAt));
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(puzzle);
  }

  // Sort within each group by savedAt (most recent first)
  for (const puzzles of groups.values()) {
    puzzles.sort((a, b) => b.savedAt - a.savedAt);
  }

  return groups;
}

/**
 * Format a date for display as group header.
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a date key that may be in various formats.
 */
function formatDateKey(dateKey: string): string {
  // If it's already formatted nicely, return as-is
  if (/\w+ \d{1,2}, \d{4}/.test(dateKey)) {
    return dateKey;
  }

  // Try to parse ISO format
  try {
    const date = new Date(dateKey);
    if (!isNaN(date.getTime())) {
      return formatDate(date);
    }
  } catch {
    // Fall through
  }

  return dateKey;
}

/**
 * Library view showing all saved puzzles grouped by date.
 * This is the home screen of the app.
 */
export function LibraryView({ onOpenPuzzle, onError }: LibraryViewProps) {
  const [puzzles, setPuzzles] = useState<PuzzleWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const isOnline = useOnlineStatus();

  // Load all puzzles on mount
  const loadPuzzles = useCallback(async () => {
    try {
      const entries = await listAllPuzzles();

      // Load progress for each puzzle
      const puzzlesWithProgress: PuzzleWithProgress[] = await Promise.all(
        entries.map(async (entry) => {
          // Load the full puzzle to calculate progress
          const puzzle = await loadPuzzleById(entry.id);
          const progress = puzzle
            ? await getPuzzleProgress(entry.id, puzzle)
            : { filled: 0, total: 0 };

          return {
            ...entry,
            progress,
          };
        })
      );

      setPuzzles(puzzlesWithProgress);
    } catch (error) {
      console.error('[LibraryView] Failed to load puzzles:', error);
      onError('Failed to load puzzle library');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    loadPuzzles();
  }, [loadPuzzles]);

  const handleOpenPuzzle = useCallback(
    async (puzzleId: string) => {
      try {
        const puzzle = await loadPuzzleById(puzzleId);
        if (puzzle) {
          onOpenPuzzle(puzzle, puzzleId);
        } else {
          onError('Puzzle not found');
        }
      } catch (error) {
        console.error('[LibraryView] Failed to open puzzle:', error);
        onError('Failed to open puzzle');
      }
    },
    [onOpenPuzzle, onError]
  );

  const handleDeletePuzzle = useCallback(async (puzzleId: string) => {
    try {
      await deletePuzzle(puzzleId);
      setPuzzles((prev) => prev.filter((p) => p.id !== puzzleId));
    } catch (error) {
      console.error('[LibraryView] Failed to delete puzzle:', error);
    }
  }, []);

  const handlePuzzleLoaded = useCallback(
    async (puzzle: Puzzle) => {
      // Generate puzzle ID
      const puzzleId = puzzle.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      // Save to library
      try {
        await savePuzzle(puzzleId, puzzle);
      } catch (error) {
        console.error('[LibraryView] Failed to save puzzle to library:', error);
      }

      // Open the puzzle immediately
      onOpenPuzzle(puzzle, puzzleId);
    },
    [onOpenPuzzle]
  );

  const groupedPuzzles = groupPuzzlesByDate(puzzles);

  return (
    <div className="library-view">
      <header className="library-header">
        <div className="library-header__left">
          <h1 className="library-title">Crossing Words</h1>
          {!isOnline && (
            <div className="library-offline" title="You are offline - downloading won't work">
              <span className="library-offline__text">Offline</span>
            </div>
          )}
        </div>
        <div className="library-actions">
          <FilePicker onPuzzleLoaded={handlePuzzleLoaded} onError={onError} />
          <PuzzleDownloader onPuzzleLoaded={handlePuzzleLoaded} onError={onError} />
        </div>
      </header>

      <main className="library-content">
        {loading ? (
          <div className="library-loading">Loading puzzles...</div>
        ) : puzzles.length === 0 ? (
          <div className="library-empty">
            <p className="library-empty__title">No puzzles yet</p>
            <p className="library-empty__subtitle">
              Import a puzzle file or download one to get started
            </p>
          </div>
        ) : (
          <div className="library-groups">
            {Array.from(groupedPuzzles.entries()).map(([dateKey, groupPuzzles]) => (
              <div key={dateKey} className="library-group">
                <h2 className="library-group__date">{formatDateKey(dateKey)}</h2>
                <div className="library-group__puzzles">
                  {groupPuzzles.map((puzzle) => (
                    <PuzzleCard
                      key={puzzle.id}
                      id={puzzle.id}
                      title={puzzle.title}
                      source={puzzle.source}
                      date={puzzle.date}
                      progress={puzzle.progress}
                      onOpen={() => handleOpenPuzzle(puzzle.id)}
                      onDelete={() => handleDeletePuzzle(puzzle.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
