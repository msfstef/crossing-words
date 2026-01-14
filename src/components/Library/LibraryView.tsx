import { useState, useEffect, useCallback, useRef } from 'react';
import { PuzzleCard } from './PuzzleCard';
import { LoadingCard } from './LoadingCard';
import { SkeletonCard } from './SkeletonCard';
import { FAB } from './FAB';
import { DownloadDialog } from './DownloadDialog';
import { PuzzleOptionsDialog } from './PuzzleOptionsDialog';
import { SettingsMenu } from '../SettingsMenu';
import { PUZZLE_SOURCES } from '../../services/puzzleSources/sources';
import { fetchPuzzle } from '../../services/puzzleSources/fetchPuzzle';
import { importPuzzle } from '../../lib/puzzleImport';
import {
  listAllPuzzles,
  deletePuzzle,
  getPuzzleProgress,
  loadPuzzleById,
  savePuzzle,
  resetPuzzleProgress,
  resetPuzzleSharing,
  type PuzzleEntry,
} from '../../lib/puzzleStorage';
import type { Puzzle } from '../../types/puzzle';
import './LibraryView.css';

interface PuzzleWithProgress extends PuzzleEntry {
  progress: { filled: number; verified: number; total: number };
}

interface GhostEntry {
  id: string;
  title: string;
  source: string;
  date: string;
  loading: true;
}

interface LibraryViewProps {
  onOpenPuzzle: (puzzle: Puzzle, puzzleId: string) => void;
  onError: (message: string) => void;
}

type LibraryEntry = PuzzleWithProgress | GhostEntry;

function isGhostEntry(entry: LibraryEntry): entry is GhostEntry {
  return 'loading' in entry && entry.loading === true;
}

/**
 * Group puzzles by date (or savedAt date if no puzzle date).
 * Groups are sorted at render time, not here.
 */
function groupEntriesByDate(entries: LibraryEntry[]): Map<string, LibraryEntry[]> {
  const groups = new Map<string, LibraryEntry[]>();

  for (const entry of entries) {
    // Use puzzle date if available, otherwise format savedAt
    const dateKey = entry.date ?? (isGhostEntry(entry) ? formatDate(new Date()) : formatDate(new Date((entry as PuzzleWithProgress).savedAt)));
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(entry);
  }

  // Sort within each group - ghosts first (loading), then by savedAt (most recent first)
  for (const groupEntries of groups.values()) {
    groupEntries.sort((a, b) => {
      // Ghosts first
      if (isGhostEntry(a) && !isGhostEntry(b)) return -1;
      if (!isGhostEntry(a) && isGhostEntry(b)) return 1;
      if (isGhostEntry(a) && isGhostEntry(b)) return 0;
      // Then by savedAt
      return (b as PuzzleWithProgress).savedAt - (a as PuzzleWithProgress).savedAt;
    });
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
  const [ghostEntries, setGhostEntries] = useState<GhostEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [optionsDialogOpen, setOptionsDialogOpen] = useState(false);
  const [selectedPuzzle, setSelectedPuzzle] = useState<{ id: string; title: string; date?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track if download dialog has a history entry
  const downloadDialogHistoryRef = useRef(false);

  // Handle back button to close download dialog
  useEffect(() => {
    const handlePopstate = () => {
      if (downloadDialogHistoryRef.current) {
        downloadDialogHistoryRef.current = false;
        setDownloadDialogOpen(false);
      }
    };

    window.addEventListener('popstate', handlePopstate);
    return () => window.removeEventListener('popstate', handlePopstate);
  }, []);

  // Open download dialog with history entry
  const openDownloadDialog = useCallback(() => {
    window.history.pushState({ type: 'dialog', dialogType: 'download' }, '');
    downloadDialogHistoryRef.current = true;
    setDownloadDialogOpen(true);
  }, []);

  // Close download dialog and clean up history if needed
  const closeDownloadDialog = useCallback(() => {
    setDownloadDialogOpen(false);
    // Clean up phantom history entry if closed via X button (not back button)
    if (downloadDialogHistoryRef.current) {
      downloadDialogHistoryRef.current = false;
      window.history.back();
    }
  }, []);

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
            : { filled: 0, verified: 0, total: 0 };

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
      onError('Failed to delete puzzle');
    }
  }, [onError]);

  const handleResetPuzzle = useCallback(async (puzzleId: string) => {
    try {
      await resetPuzzleProgress(puzzleId);
      // Reload puzzles to refresh progress
      await loadPuzzles();
    } catch (error) {
      console.error('[LibraryView] Failed to reset puzzle:', error);
      onError('Failed to reset puzzle');
    }
  }, [loadPuzzles, onError]);

  const handleResetSharing = useCallback((puzzleId: string) => {
    try {
      resetPuzzleSharing(puzzleId);
    } catch (error) {
      console.error('[LibraryView] Failed to reset sharing:', error);
      onError('Failed to reset sharing');
    }
  }, [onError]);

  const handleLongPress = useCallback((puzzleId: string, title: string, source?: string, date?: string) => {
    setSelectedPuzzle({ id: puzzleId, title: source ?? title, date });
    setOptionsDialogOpen(true);
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

  // Handle file import from FAB
  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const puzzle = await importPuzzle(file);
        await handlePuzzleLoaded(puzzle);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to load puzzle';
        onError(message);
      }

      // Clear input value so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handlePuzzleLoaded, onError]
  );

  // Handle download with optimistic UI
  const handleDownload = useCallback(
    async (sourceId: string, sourceName: string, puzzleDate: Date) => {
      // Close dialog immediately and clean up history
      closeDownloadDialog();

      // Create ghost entry
      const ghostId = `loading-${Date.now()}`;
      const formattedDate = puzzleDate.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      const ghost: GhostEntry = {
        id: ghostId,
        title: `${sourceName} - ${formattedDate}`,
        source: sourceName,
        date: formattedDate,
        loading: true,
      };

      // Add ghost to state
      setGhostEntries((prev) => [...prev, ghost]);

      try {
        const source = PUZZLE_SOURCES.find((s) => s.id === sourceId);
        if (!source) throw new Error('Invalid source');

        const buffer = await fetchPuzzle(sourceId, puzzleDate);

        // Use existing importPuzzle with filename hint for format detection
        const puzzle = await importPuzzle(buffer, `puzzle.${source.format}`);

        // Generate puzzle ID
        const puzzleId = puzzle.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        // Save to library with source and date from download dialog
        await savePuzzle(puzzleId, puzzle, sourceName, formattedDate);

        // Remove ghost and reload puzzles to show real entry
        setGhostEntries((prev) => prev.filter((g) => g.id !== ghostId));
        await loadPuzzles();
      } catch (err) {
        // Remove ghost entry on error
        setGhostEntries((prev) => prev.filter((g) => g.id !== ghostId));
        onError(err instanceof Error ? err.message : 'Failed to download puzzle');
      }
    },
    [closeDownloadDialog, loadPuzzles, onError]
  );

  // Combine puzzles and ghost entries
  const allEntries: LibraryEntry[] = [...ghostEntries, ...puzzles];
  const groupedEntries = groupEntriesByDate(allEntries);
  const hasEntries = allEntries.length > 0;

  return (
    <div className="library-view">
      <header className="library-header">
        <div className="library-header__left">
          <svg className="library-logo" viewBox="0 0 192 192" aria-hidden="true">
            <rect width="192" height="192" fill="var(--color-bg-secondary)"/>
            <g stroke="currentColor" strokeWidth="6" fill="none">
              <rect x="36" y="36" width="120" height="120"/>
              <line x1="76" y1="36" x2="76" y2="156"/>
              <line x1="116" y1="36" x2="116" y2="156"/>
              <line x1="36" y1="76" x2="156" y2="76"/>
              <line x1="36" y1="116" x2="156" y2="116"/>
            </g>
            <rect x="76" y="76" width="40" height="40" fill="var(--color-bg-secondary)"/>
            <text x="56" y="65" fill="currentColor" fontFamily="system-ui, sans-serif" fontSize="28" textAnchor="middle">C</text>
            <text x="136" y="105" fill="currentColor" fontFamily="system-ui, sans-serif" fontSize="28" textAnchor="middle">W</text>
          </svg>
          <h1 className="library-title">Crossing Words</h1>
        </div>
        <div className="library-actions">
          <SettingsMenu />
        </div>
      </header>

      <main className="library-content">
        {loading ? (
          <div className="library-skeleton">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : !hasEntries ? (
          <div className="library-empty">
            <p className="library-empty__title">No puzzles yet</p>
            <p className="library-empty__subtitle">
              Tap the + button to import or download a puzzle
            </p>
          </div>
        ) : (
          <div className="library-groups">
            {Array.from(groupedEntries.entries())
              .sort(([dateA], [dateB]) => {
                // Sort descending (most recent first)
                const a = new Date(dateA).getTime();
                const b = new Date(dateB).getTime();
                return b - a;
              })
              .map(([dateKey, groupEntries]) => (
              <div key={dateKey} className="library-group">
                <h2 className="library-group__date">{formatDateKey(dateKey)}</h2>
                <div className="library-group__puzzles">
                  {groupEntries.map((entry) =>
                    isGhostEntry(entry) ? (
                      <LoadingCard
                        key={entry.id}
                        title={entry.title}
                        source={entry.source}
                      />
                    ) : (
                      <PuzzleCard
                        key={entry.id}
                        id={entry.id}
                        title={entry.title}
                        source={entry.source}
                        date={entry.date}
                        progress={entry.progress}
                        onOpen={() => handleOpenPuzzle(entry.id)}
                        onDelete={() => handleDeletePuzzle(entry.id)}
                        onLongPress={() => handleLongPress(entry.id, entry.title, entry.source, entry.date)}
                      />
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Hidden file input for FAB import */}
      <input
        type="file"
        accept=".puz,.ipuz,.jpz"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="library-file-input"
      />

      {/* FAB for Import/Download */}
      <FAB
        onDownloadClick={openDownloadDialog}
        fileInputRef={fileInputRef}
      />

      {/* Download dialog */}
      <DownloadDialog
        isOpen={downloadDialogOpen}
        onClose={closeDownloadDialog}
        onDownload={handleDownload}
      />

      {/* Puzzle options dialog */}
      {selectedPuzzle && (
        <PuzzleOptionsDialog
          isOpen={optionsDialogOpen}
          puzzleTitle={selectedPuzzle.title}
          puzzleDate={selectedPuzzle.date}
          onClose={() => setOptionsDialogOpen(false)}
          onResetPuzzle={() => selectedPuzzle && handleResetPuzzle(selectedPuzzle.id)}
          onResetSharing={() => selectedPuzzle && handleResetSharing(selectedPuzzle.id)}
          onDelete={() => selectedPuzzle && handleDeletePuzzle(selectedPuzzle.id)}
        />
      )}
    </div>
  );
}
