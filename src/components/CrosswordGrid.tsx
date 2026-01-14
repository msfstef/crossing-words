import { useMemo, useRef, useState, useLayoutEffect, useEffect } from "react";
import type { Puzzle, Clue } from "../types/puzzle";
import type { Collaborator } from "../collaboration/types";
import { useSwipeNavigation, type SwipeDirection } from "../hooks/useSwipeNavigation";
import { usePinchGesture } from "../hooks/usePinchGesture";
import { computeGridDimensions } from "../lib/gridSizing";
import "./CrosswordGrid.css";

/** Grid gap value in pixels */
export const GRID_GAP = 2;
/** Grid padding value in pixels (each side) */
export const GRID_PADDING = 2;
/** Minimum cell size in pixels */
export const MIN_CELL_SIZE = 12;
/** Maximum cell size in pixels */
export const MAX_CELL_SIZE = 36;
/** Edge indicator size as fraction of cell size - matches CSS */
export const EDGE_INDICATOR_FRACTION = 0.4;

/**
 * Calculate optimal cell size to fit puzzle within container bounds.
 * Returns cell size in pixels, clamped between min and max.
 *
 * When edge indicators are present, accounts for the extra space they take
 * (40% of cell size per edge).
 */
export function calculateCellSize(
  containerWidth: number,
  containerHeight: number,
  cols: number,
  rows: number,
  edgeIndicators?: { top: boolean; bottom: boolean; left: boolean; right: boolean } | null,
): number {
  const totalGapX = (cols - 1) * GRID_GAP + GRID_PADDING * 2;
  const totalGapY = (rows - 1) * GRID_GAP + GRID_PADDING * 2;

  // If edge indicators are present, we need to account for their space.
  // Edge indicators take EDGE_INDICATOR_FRACTION of cell size each.
  // We solve: availableWidth = cols * cellSize + totalGapX + (numHorizontalEdges * EDGE_INDICATOR_FRACTION * cellSize)
  // Which gives: cellSize = (containerWidth - totalGapX) / (cols + numHorizontalEdges * EDGE_INDICATOR_FRACTION)

  let horizontalEdgeFraction = 0;
  let verticalEdgeFraction = 0;

  if (edgeIndicators) {
    if (edgeIndicators.left) horizontalEdgeFraction += EDGE_INDICATOR_FRACTION;
    if (edgeIndicators.right) horizontalEdgeFraction += EDGE_INDICATOR_FRACTION;
    if (edgeIndicators.top) verticalEdgeFraction += EDGE_INDICATOR_FRACTION;
    if (edgeIndicators.bottom) verticalEdgeFraction += EDGE_INDICATOR_FRACTION;
  }

  const maxCellWidth = (containerWidth - totalGapX) / (cols + horizontalEdgeFraction);
  const maxCellHeight = (containerHeight - totalGapY) / (rows + verticalEdgeFraction);

  const cellSize = Math.min(maxCellWidth, maxCellHeight);

  // Clamp between MIN_CELL_SIZE and MAX_CELL_SIZE
  return Math.max(MIN_CELL_SIZE, Math.min(cellSize, MAX_CELL_SIZE));
}

/**
 * Get initial cell size using the shared grid sizing utility.
 * This ensures the grid renders at the same size as PuzzleSkeleton
 * from the very first frame, eliminating resize flash.
 */
function getInitialCellSize(
  cols: number,
  rows: number,
  isTouchDevice: boolean
): number {
  return computeGridDimensions(cols, rows, isTouchDevice).cellSize;
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
  /** Local user's color for selection styling (matches what collaborators see) */
  localUserColor?: string;
  /** Set of verified cell keys ("row,col") */
  verifiedCells?: Set<string>;
  /** Set of error cell keys ("row,col") */
  errorCells?: Set<string>;
  /** Callback for swipe navigation (mobile only) */
  onSwipe?: (direction: SwipeDirection) => void;
  /** Whether the device supports touch */
  isTouchDevice?: boolean;
  /** Set of cells from referenced clues (whole word highlight) - "row,col" format */
  referencedClueCells?: Set<string>;
  /** Set of cells from letter-range references (individual cell highlight) - "row,col" format */
  letterReferenceCells?: Set<string>;
  /** Whether zoom mode is active */
  isZoomMode?: boolean;
  /** Viewport bounds for zoom mode (startRow, endRow, startCol, endCol) */
  zoomViewport?: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  /** Edge indicators showing which edges have hidden content */
  edgeIndicators?: { top: boolean; bottom: boolean; left: boolean; right: boolean } | null;
  /** Callback to toggle zoom mode */
  onToggleZoom?: () => void;
  /** Whether to animate letters (for CRDT initial load) */
  animatingLetters?: boolean;
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
 * Generate multi-color border effect for overlapping collaborator cursors.
 * Creates a visual indication using colored borders when multiple collaborators
 * focus on the same cell.
 *
 * Strategy:
 * - 1 color: Simple solid outline
 * - 2 colors: Split border (top/bottom vs left/right in alternating colors)
 * - 3+ colors: Each side gets a different color (top, right, bottom cycling through colors)
 *
 * This approach is performant and creates a clear visual distinction without
 * requiring complex CSS patterns or pseudo-elements.
 */
function createMultiColorBorder(colors: string[]): React.CSSProperties {
  if (colors.length === 0) return {};

  const alpha = 0.75; // Strong alpha for visibility

  if (colors.length === 1) {
    // Single collaborator: simple outline
    return {
      outline: `2px solid ${hexToRgba(colors[0], alpha)}`,
      outlineOffset: '-2px',
      zIndex: 5,
    };
  }

  // Multiple collaborators: use box-shadow to create colored segments
  // This creates distinct colored borders on different sides
  const thickness = 3;

  if (colors.length === 2) {
    // Two colors: alternate top/bottom vs left/right
    const [color1, color2] = colors.map(c => hexToRgba(c, alpha));

    return {
      boxShadow: `
        0 -${thickness}px 0 0 ${color1},
        ${thickness}px 0 0 0 ${color2},
        0 ${thickness}px 0 0 ${color1},
        -${thickness}px 0 0 0 ${color2}
      `,
      zIndex: 5,
      position: 'relative',
    };
  }

  // Three or more colors: each side gets its own color
  const [color1, color2, color3] = colors.slice(0, 3).map(c => hexToRgba(c, alpha));

  return {
    boxShadow: `
      0 -${thickness}px 0 0 ${color1},
      ${thickness}px 0 0 0 ${color2},
      0 ${thickness}px 0 0 ${color3},
      -${thickness}px 0 0 0 ${colors.length > 3 ? hexToRgba(colors[3], alpha) : color1}
    `,
    zIndex: 5,
    position: 'relative',
  };
}

/**
 * CrosswordGrid renders the puzzle grid with cells that can display letters.
 * Cell size is pre-calculated from viewport dimensions for instant rendering,
 * then refined via ResizeObserver to match actual container dimensions.
 */
export function CrosswordGrid({
  puzzle,
  userEntries,
  selectedCell,
  currentWord,
  onCellClick,
  collaborators = [],
  localUserColor,
  verifiedCells = new Set(),
  errorCells = new Set(),
  onSwipe,
  isTouchDevice = false,
  referencedClueCells = new Set(),
  letterReferenceCells = new Set(),
  isZoomMode = false,
  zoomViewport = null,
  edgeIndicators = null,
  onToggleZoom,
  animatingLetters = false,
}: CrosswordGridProps) {
  // Container ref for measuring available space
  const containerRef = useRef<HTMLDivElement>(null);

  // Mount guard to prevent tap propagation from library card.
  // When navigating from library, the finger-up event can propagate to the
  // newly mounted grid cells. This guard ignores clicks for a brief period.
  const [isMountGuardActive, setIsMountGuardActive] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMountGuardActive(false);
    }, 100); // 100ms is enough for the tap to complete
    return () => clearTimeout(timer);
  }, []);

  // Swipe navigation handlers (only active on touch devices)
  const swipeHandlers = useSwipeNavigation({
    onSwipe: onSwipe ?? (() => {}),
    enabled: isTouchDevice && Boolean(onSwipe),
  });

  // Pinch gesture handlers for zoom toggle
  // Pinch out (fingers apart) = zoom in, Pinch in (fingers closer) = zoom out
  const pinchHandlers = usePinchGesture({
    onPinchOut: onToggleZoom && !isZoomMode ? onToggleZoom : undefined,
    onPinchIn: onToggleZoom && isZoomMode ? onToggleZoom : undefined,
  });
  // Determine grid dimensions based on zoom mode
  const { gridWidth, gridHeight, gridStartRow: _gridStartRow, gridStartCol: _gridStartCol } = useMemo(() => {
    if (isZoomMode && zoomViewport) {
      return {
        gridWidth: zoomViewport.endCol - zoomViewport.startCol + 1,
        gridHeight: zoomViewport.endRow - zoomViewport.startRow + 1,
        gridStartRow: zoomViewport.startRow,
        gridStartCol: zoomViewport.startCol,
      };
    }
    return {
      gridWidth: puzzle.width,
      gridHeight: puzzle.height,
      gridStartRow: 0,
      gridStartCol: 0,
    };
  }, [isZoomMode, zoomViewport, puzzle.width, puzzle.height]);

  // Cell size state - initialize with estimate from viewport dimensions
  // ResizeObserver corrects any discrepancy after mount
  const [cellSize, setCellSize] = useState(() =>
    getInitialCellSize(gridWidth, gridHeight, isTouchDevice)
  );

  // useLayoutEffect to correct initial estimate and handle dynamic resizing
  // Initial estimate from getInitialCellSize is usually accurate,
  // but ResizeObserver ensures we match actual container dimensions
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateCellSize = () => {
      const { width, height } = container.getBoundingClientRect();
      // Pass edge indicators to account for their space in zoom mode
      const newSize = calculateCellSize(width, height, gridWidth, gridHeight, edgeIndicators);
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
  }, [gridWidth, gridHeight, edgeIndicators]);

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

  /**
   * Build a map of cursor positions to collaborator colors.
   * Shows exact cell each collaborator is focused on (border indicator).
   * Now stores ALL collaborators on a cell (up to 3) for overlap visualization.
   */
  const collaboratorCursors = useMemo(() => {
    const cursors = new Map<string, string[]>(); // key -> colors array

    for (const collab of collaborators) {
      if (!collab.cursor) continue;
      const key = `${collab.cursor.row},${collab.cursor.col}`;

      // Add this collaborator's color to the cell
      if (!cursors.has(key)) {
        cursors.set(key, []);
      }

      const colors = cursors.get(key)!;
      // Limit to 3 colors to keep visual manageable
      if (colors.length < 3) {
        colors.push(collab.user.color);
      }
    }

    return cursors;
  }, [collaborators]);

  // Filter cells based on zoom viewport
  const visibleCells = useMemo(() => {
    if (isZoomMode && zoomViewport) {
      return puzzle.grid.flat().filter(cell =>
        cell.row >= zoomViewport.startRow &&
        cell.row <= zoomViewport.endRow &&
        cell.col >= zoomViewport.startCol &&
        cell.col <= zoomViewport.endCol
      );
    }
    return puzzle.grid.flat();
  }, [puzzle.grid, isZoomMode, zoomViewport]);

  // Compute edge cells for partial cell indicators
  // These are cells just beyond the viewport boundary that show as hints
  const edgeCells = useMemo(() => {
    if (!isZoomMode || !zoomViewport || !edgeIndicators) {
      return { top: [], bottom: [], left: [], right: [] };
    }

    const { startRow, endRow, startCol, endCol } = zoomViewport;
    const { height, width } = puzzle;

    return {
      // Top edge: row above viewport (if exists)
      top: edgeIndicators.top && startRow > 0
        ? puzzle.grid[startRow - 1].filter(cell =>
            cell.col >= startCol && cell.col <= endCol
          )
        : [],
      // Bottom edge: row below viewport (if exists)
      bottom: edgeIndicators.bottom && endRow < height - 1
        ? puzzle.grid[endRow + 1].filter(cell =>
            cell.col >= startCol && cell.col <= endCol
          )
        : [],
      // Left edge: column before viewport (if exists)
      left: edgeIndicators.left && startCol > 0
        ? puzzle.grid
            .filter((_, rowIndex) => rowIndex >= startRow && rowIndex <= endRow)
            .map(row => row[startCol - 1])
        : [],
      // Right edge: column after viewport (if exists)
      right: edgeIndicators.right && endCol < width - 1
        ? puzzle.grid
            .filter((_, rowIndex) => rowIndex >= startRow && rowIndex <= endRow)
            .map(row => row[endCol + 1])
        : [],
    };
  }, [isZoomMode, zoomViewport, edgeIndicators, puzzle.grid, puzzle.height, puzzle.width]);

  // Merge touch handlers (swipe and pinch)
  const touchHandlers = useMemo(() => {
    return {
      onTouchStart: (e: React.TouchEvent) => {
        swipeHandlers.onTouchStart(e);
        pinchHandlers.onTouchStart(e);
      },
      onTouchMove: (e: React.TouchEvent) => {
        swipeHandlers.onTouchMove(e);
        pinchHandlers.onTouchMove(e);
      },
      onTouchEnd: (e: React.TouchEvent) => {
        swipeHandlers.onTouchEnd(e);
        pinchHandlers.onTouchEnd(e);
      },
      onTouchCancel: (e: React.TouchEvent) => {
        swipeHandlers.onTouchCancel();
        pinchHandlers.onTouchCancel(e);
      },
    };
  }, [swipeHandlers, pinchHandlers]);

  // Helper to render an edge indicator cell (partial visibility, tappable)
  const renderEdgeCell = (
    cell: typeof puzzle.grid[0][0],
    position: 'top' | 'bottom' | 'left' | 'right'
  ) => {
    const key = `edge-${position}-${cell.row},${cell.col}`;
    const userEntry = userEntries.get(`${cell.row},${cell.col}`);

    return (
      <div
        key={key}
        className={`crossword-cell crossword-cell--edge-indicator crossword-cell--edge-${position} ${
          cell.isBlack ? 'cell--black' : 'cell--white'
        }`}
        data-row={cell.row}
        data-col={cell.col}
        onClick={() => !cell.isBlack && onCellClick(cell.row, cell.col)}
      >
        {!cell.isBlack && (
          <span className="cell-letter">{userEntry || ""}</span>
        )}
      </div>
    );
  };

  // Compute corner rounding classes for zoom mode
  // Corners should be rounded only when at actual puzzle edge (no hidden content)
  const cornerClasses = useMemo(() => {
    if (!isZoomMode || !edgeIndicators) return '';
    const classes: string[] = [];
    // Top-left corner: rounded if no top AND no left edge (at actual puzzle corner)
    if (!edgeIndicators.top && !edgeIndicators.left) classes.push('grid--rounded-tl');
    // Top-right corner: rounded if no top AND no right edge
    if (!edgeIndicators.top && !edgeIndicators.right) classes.push('grid--rounded-tr');
    // Bottom-left corner: rounded if no bottom AND no left edge
    if (!edgeIndicators.bottom && !edgeIndicators.left) classes.push('grid--rounded-bl');
    // Bottom-right corner: rounded if no bottom AND no right edge
    if (!edgeIndicators.bottom && !edgeIndicators.right) classes.push('grid--rounded-br');
    return classes.join(' ');
  }, [isZoomMode, edgeIndicators]);

  // Compute CSS variables for edge alignment and inner shadow
  const containerStyle = useMemo(() => {
    const style: React.CSSProperties & { [key: string]: string } = {
      '--cell-size': `${cellSize}px`,
    };

    if (isZoomMode && edgeIndicators) {
      // Set left/right edge offsets for top/bottom alignment
      const edgeWidth = cellSize * EDGE_INDICATOR_FRACTION;
      style['--left-edge-offset'] = edgeIndicators.left ? `${edgeWidth}px` : '0px';
      style['--right-edge-offset'] = edgeIndicators.right ? `${edgeWidth}px` : '0px';

      // Build inner shadow to indicate hidden content
      // Subtle inset shadow on edges with more content
      const shadows: string[] = [];
      const shadowSize = '8px';
      const shadowColor = 'rgba(0, 0, 0, 0.15)';
      if (edgeIndicators.top) shadows.push(`inset 0 ${shadowSize} ${shadowSize} -4px ${shadowColor}`);
      if (edgeIndicators.bottom) shadows.push(`inset 0 -${shadowSize} ${shadowSize} -4px ${shadowColor}`);
      if (edgeIndicators.left) shadows.push(`inset ${shadowSize} 0 ${shadowSize} -4px ${shadowColor}`);
      if (edgeIndicators.right) shadows.push(`inset -${shadowSize} 0 ${shadowSize} -4px ${shadowColor}`);
      if (shadows.length > 0) {
        style['--edge-shadow'] = shadows.join(', ');
      }
    }

    return style;
  }, [cellSize, isZoomMode, edgeIndicators]);

  return (
    <div
      ref={containerRef}
      className={`crossword-grid-container ${isZoomMode ? 'crossword-grid-container--zoomed' : ''} ${animatingLetters ? 'crossword-grid-container--animating-letters' : ''}`}
      style={containerStyle as React.CSSProperties}
      {...touchHandlers}
    >
      {/* Top edge indicator cells */}
      {isZoomMode && edgeCells.top.length > 0 && (
        <div
          className="crossword-edge-indicator crossword-edge-indicator--top"
          style={{
            gridTemplateColumns: `repeat(${gridWidth}, var(--cell-size))`,
          }}
        >
          {edgeCells.top.map(cell => renderEdgeCell(cell, 'top'))}
        </div>
      )}

      <div className="crossword-grid-row">
        {/* Left edge indicator cells */}
        {isZoomMode && edgeCells.left.length > 0 && (
          <div
            className="crossword-edge-indicator crossword-edge-indicator--left"
            style={{
              gridTemplateRows: `repeat(${gridHeight}, var(--cell-size))`,
            }}
          >
            {edgeCells.left.map(cell => renderEdgeCell(cell, 'left'))}
          </div>
        )}

        <div
          className={`crossword-grid ${isZoomMode ? `crossword-grid--zoomed ${cornerClasses}` : ''}`}
          style={{
            gridTemplateColumns: `repeat(${gridWidth}, var(--cell-size))`,
            gridTemplateRows: `repeat(${gridHeight}, var(--cell-size))`,
          }}
        >
        {visibleCells.map((cell) => {
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

          // Get collaborator cursor colors (exact focused cell) - may be multiple!
          const cursorColors = collaboratorCursors.get(key);
          // Only show cursor if not the local user's selected cell
          const hasCollaboratorCursor = cursorColors && cursorColors.length > 0 && !isSelected;

          // Check verification and error status
          const isVerified = verifiedCells.has(key);
          const hasError = errorCells.has(key);

          // Check clue reference highlights
          // Whole-clue references: only show when not in current word (avoid visual conflict)
          // Letter-specific references: show even in current word (for "letters X-Y here" patterns)
          const isReferencedClue = referencedClueCells.has(key) && !inWord && !isSelected;
          const isReferencedLetter = letterReferenceCells.has(key);

          // Determine if local user has a color (in collaborative mode)
          const hasLocalColor = Boolean(localUserColor);

          const cellClasses = [
            "crossword-cell",
            cell.isBlack ? "cell--black" : "cell--white",
            // Use custom selection styling when we have local color, otherwise fall back to CSS
            isSelected && !hasLocalColor ? "cell--selected" : "",
            isSelected && hasLocalColor ? "cell--selected-custom" : "",
            inWord && !isSelected && !hasLocalColor ? "cell--in-word" : "",
            inWord && !isSelected && hasLocalColor ? "cell--in-word-custom" : "",
            hasCollaboratorHighlight ? "cell--collaborator" : "",
            hasCollaboratorCursor ? "cell--collaborator-cursor" : "",
            isVerified ? "cell--verified" : "",
            hasError ? "cell--error" : "",
            // Clue reference highlights (champagne/gold color)
            isReferencedClue ? "cell--referenced-clue" : "",
            isReferencedLetter ? "cell--referenced-letter" : "",
          ]
            .filter(Boolean)
            .join(" ");

          // Build inline style for highlighting
          // Local user: Uses their collaborator color for consistency
          // Collaborators: Subtle styling so they don't distract from local user
          const cellStyle: React.CSSProperties = {};

          // Local user's word highlight (subtle background)
          if (inWord && !isSelected && localUserColor) {
            cellStyle.backgroundColor = hexToRgba(localUserColor, 0.25);
          }
          // Local user's selected cell (prominent outline with glow)
          if (isSelected && localUserColor) {
            cellStyle.outline = `3px solid ${localUserColor}`;
            cellStyle.outlineOffset = '-3px';
            cellStyle.boxShadow = `0 0 0 2px ${hexToRgba(localUserColor, 0.4)}, inset 0 0 8px ${hexToRgba(localUserColor, 0.3)}`;
            cellStyle.zIndex = 10; // Above collaborator cursors
            cellStyle.backgroundColor = hexToRgba(localUserColor, 0.25);
          }
          // Collaborator word highlight (very subtle)
          if (hasCollaboratorHighlight) {
            cellStyle.backgroundColor = hexToRgba(collaboratorColor, 0.15);
          }
          // Collaborator cursor(s) - may be multiple overlapping collaborators!
          if (hasCollaboratorCursor && cursorColors) {
            const multiColorStyle = createMultiColorBorder(cursorColors);
            Object.assign(cellStyle, multiColorStyle);
          }

          return (
            <div
              key={key}
              className={cellClasses}
              style={cellStyle}
              data-row={cell.row}
              data-col={cell.col}
              onClick={() => !cell.isBlack && !isMountGuardActive && onCellClick(cell.row, cell.col)}
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

        {/* Right edge indicator cells */}
        {isZoomMode && edgeCells.right.length > 0 && (
          <div
            className="crossword-edge-indicator crossword-edge-indicator--right"
            style={{
              gridTemplateRows: `repeat(${gridHeight}, var(--cell-size))`,
            }}
          >
            {edgeCells.right.map(cell => renderEdgeCell(cell, 'right'))}
          </div>
        )}
      </div>

      {/* Bottom edge indicator cells */}
      {isZoomMode && edgeCells.bottom.length > 0 && (
        <div
          className="crossword-edge-indicator crossword-edge-indicator--bottom"
          style={{
            gridTemplateColumns: `repeat(${gridWidth}, var(--cell-size))`,
          }}
        >
          {edgeCells.bottom.map(cell => renderEdgeCell(cell, 'bottom'))}
        </div>
      )}
    </div>
  );
}
