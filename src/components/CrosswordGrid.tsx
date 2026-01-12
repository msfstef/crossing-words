import { useMemo, useRef, useState, useEffect } from "react";
import type { Puzzle, Clue } from "../types/puzzle";
import type { Collaborator } from "../collaboration/types";
import "./CrosswordGrid.css";

/**
 * Calculate optimal cell size to fit puzzle within container bounds.
 * Returns cell size in pixels, clamped between min and max.
 */
function calculateCellSize(
  containerWidth: number,
  containerHeight: number,
  cols: number,
  rows: number,
): number {
  const gap = 2; // --grid-gap value
  const padding = 4; // grid padding (2px each side)
  const totalGapX = (cols - 1) * gap + padding;
  const totalGapY = (rows - 1) * gap + padding;

  const maxCellWidth = (containerWidth - totalGapX) / cols;
  const maxCellHeight = (containerHeight - totalGapY) / rows;

  const cellSize = Math.min(maxCellWidth, maxCellHeight);

  // Clamp between 16px (readable minimum) and 36px (comfortable maximum)
  return Math.max(16, Math.min(cellSize, 36));
}

interface CrosswordGridProps {
  puzzle: Puzzle;
  userEntries: Map<string, string>;
  selectedCell: { row: number; col: number } | null;
  direction: "across" | "down";
  currentWord: { row: number; col: number }[] | null;
  onCellClick: (row: number, col: number) => void;
  /** Collaborators to show word highlights for */
  collaborators?: Collaborator[];
  /** Set of verified cell keys ("row,col") */
  verifiedCells?: Set<string>;
  /** Set of error cell keys ("row,col") */
  errorCells?: Set<string>;
}

/**
 * Find the clue that contains a cell in the given direction.
 */
function findClueForCell(
  puzzle: Puzzle,
  row: number,
  col: number,
  dir: "across" | "down",
): Clue | null {
  const clues = dir === "across" ? puzzle.clues.across : puzzle.clues.down;

  for (const clue of clues) {
    if (dir === "across") {
      // Check if cell is in this across clue: same row, within column range
      if (row === clue.row && col >= clue.col && col < clue.col + clue.length) {
        return clue;
      }
    } else {
      // Check if cell is in this down clue: same column, within row range
      if (col === clue.col && row >= clue.row && row < clue.row + clue.length) {
        return clue;
      }
    }
  }

  return null;
}

/**
 * Get all cells in the word containing the given cell position.
 */
function getWordCells(
  puzzle: Puzzle,
  row: number,
  col: number,
  direction: "across" | "down",
): { row: number; col: number }[] {
  const clue = findClueForCell(puzzle, row, col, direction);
  if (!clue) return [];

  const cells: { row: number; col: number }[] = [];

  if (direction === "across") {
    for (let i = 0; i < clue.length; i++) {
      const c = clue.col + i;
      if (c < puzzle.width && !puzzle.grid[clue.row][c].isBlack) {
        cells.push({ row: clue.row, col: c });
      }
    }
  } else {
    for (let i = 0; i < clue.length; i++) {
      const r = clue.row + i;
      if (r < puzzle.height && !puzzle.grid[r][clue.col].isBlack) {
        cells.push({ row: r, col: clue.col });
      }
    }
  }

  return cells;
}

/**
 * Convert hex color to rgba with specified alpha.
 */
function hexToRgba(hex: string, alpha: number): string {
  // Remove # if present
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * CrosswordGrid renders the puzzle grid with cells that can display letters.
 * Uses ResizeObserver to dynamically calculate cell size based on available space.
 */
export function CrosswordGrid({
  puzzle,
  userEntries,
  selectedCell,
  currentWord,
  onCellClick,
  collaborators = [],
  verifiedCells = new Set(),
  errorCells = new Set(),
}: CrosswordGridProps) {
  // Container ref for measuring available space
  const containerRef = useRef<HTMLDivElement>(null);
  // Cell size state - starts with default, updates via ResizeObserver
  const [cellSize, setCellSize] = useState(30);

  // ResizeObserver to track container size and recalculate cell size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateCellSize = () => {
      const { width, height } = container.getBoundingClientRect();
      const newSize = calculateCellSize(width, height, puzzle.width, puzzle.height);
      setCellSize(newSize);
    };

    // Initial calculation
    updateCellSize();

    // Observe for size changes
    const observer = new ResizeObserver(() => {
      updateCellSize();
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [puzzle.width, puzzle.height]);

  /**
   * Check if a cell is part of the currently selected word
   */
  const isInCurrentWord = (row: number, col: number): boolean => {
    if (!currentWord) return false;
    return currentWord.some((cell) => cell.row === row && cell.col === col);
  };

  /**
   * Build a map of cell positions to collaborator colors for word highlighting.
   * First collaborator with a cursor on that word "wins" the color.
   */
  const collaboratorHighlights = useMemo(() => {
    const highlights = new Map<string, string>();

    for (const collab of collaborators) {
      if (!collab.cursor) continue;

      const { row, col, direction } = collab.cursor;
      const wordCells = getWordCells(puzzle, row, col, direction);

      for (const cell of wordCells) {
        const key = `${cell.row},${cell.col}`;
        // Only set if no other collaborator claimed this cell
        if (!highlights.has(key)) {
          highlights.set(key, collab.user.color);
        }
      }
    }

    return highlights;
  }, [puzzle, collaborators]);

  return (
    <div
      ref={containerRef}
      className="crossword-grid-container"
      style={{ '--cell-size': `${cellSize}px` } as React.CSSProperties}
    >
      <div
        className="crossword-grid"
        style={{
          gridTemplateColumns: `repeat(${puzzle.width}, var(--cell-size))`,
          gridTemplateRows: `repeat(${puzzle.height}, var(--cell-size))`,
        }}
      >
      {puzzle.grid.flat().map((cell) => {
        const key = `${cell.row},${cell.col}`;
        const isSelected =
          selectedCell?.row === cell.row && selectedCell?.col === cell.col;
        const inWord = isInCurrentWord(cell.row, cell.col);
        const userEntry = userEntries.get(key);

        // Get collaborator highlight color for this cell (if any)
        const collaboratorColor = collaboratorHighlights.get(key);
        // Only show collaborator highlight if not in local user's current word
        const hasCollaboratorHighlight =
          collaboratorColor && !inWord && !isSelected;

        // Check verification and error status
        const isVerified = verifiedCells.has(key);
        const hasError = errorCells.has(key);

        const cellClasses = [
          "crossword-cell",
          cell.isBlack ? "cell--black" : "cell--white",
          isSelected ? "cell--selected" : "",
          inWord && !isSelected ? "cell--in-word" : "",
          hasCollaboratorHighlight ? "cell--collaborator" : "",
          isVerified ? "cell--verified" : "",
          hasError ? "cell--error" : "",
        ]
          .filter(Boolean)
          .join(" ");

        // Build inline style for collaborator highlight (dynamic color)
        const cellStyle = hasCollaboratorHighlight
          ? { backgroundColor: hexToRgba(collaboratorColor, 0.25) }
          : undefined;

        return (
          <div
            key={key}
            className={cellClasses}
            style={cellStyle}
            data-row={cell.row}
            data-col={cell.col}
            onClick={() => !cell.isBlack && onCellClick(cell.row, cell.col)}
          >
            {cell.clueNumber && (
              <span className="clue-number">{cell.clueNumber}</span>
            )}
            {!cell.isBlack && (
              <span className="cell-letter">{userEntry || ""}</span>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
