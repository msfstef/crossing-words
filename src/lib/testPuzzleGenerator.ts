import type { Puzzle, Cell, Clue } from '../types/puzzle';

/**
 * Options for generating test puzzles of arbitrary sizes
 */
export interface TestPuzzleOptions {
  width: number;
  height: number;
  title?: string;
  author?: string;
  /** Pattern for black cells: 'none' = all white, 'standard' = typical crossword, 'symmetric' = symmetric pattern */
  blackCellPattern?: 'none' | 'standard' | 'symmetric';
}

/**
 * Create a test puzzle of arbitrary size for testing grid rendering.
 * Generates valid clues automatically based on grid layout.
 */
export function createTestPuzzle(options: TestPuzzleOptions): Puzzle {
  const {
    width,
    height,
    title = `Test ${width}x${height} Puzzle`,
    author = 'Test Generator',
    blackCellPattern = 'standard',
  } = options;

  const grid = createGrid(width, height, blackCellPattern);
  const clues = generateClues(grid, width, height);

  return { title, author, width, height, grid, clues };
}

/**
 * Create grid cells with optional black cell patterns
 */
function createGrid(
  width: number,
  height: number,
  pattern: 'none' | 'standard' | 'symmetric'
): Cell[][] {
  const grid: Cell[][] = [];
  const blackCells = getBlackCellPositions(width, height, pattern);

  // Track which cells need clue numbers
  let clueNumber = 0;
  const clueNumbers = new Map<string, number>();

  // First pass: determine clue numbers
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const isBlack = blackCells.has(`${row},${col}`);
      if (!isBlack) {
        const startsAcross = col === 0 || blackCells.has(`${row},${col - 1}`);
        const startsDown = row === 0 || blackCells.has(`${row - 1},${col}`);

        // Check if this starts a word (must have at least 2 letters)
        const hasAcrossWord =
          startsAcross &&
          col < width - 1 &&
          !blackCells.has(`${row},${col + 1}`);
        const hasDownWord =
          startsDown &&
          row < height - 1 &&
          !blackCells.has(`${row + 1},${col}`);

        if (hasAcrossWord || hasDownWord) {
          clueNumber++;
          clueNumbers.set(`${row},${col}`, clueNumber);
        }
      }
    }
  }

  // Second pass: create cells
  for (let row = 0; row < height; row++) {
    const rowCells: Cell[] = [];
    for (let col = 0; col < width; col++) {
      const isBlack = blackCells.has(`${row},${col}`);
      const cellClueNumber = clueNumbers.get(`${row},${col}`);

      rowCells.push({
        row,
        col,
        letter: isBlack ? null : getTestLetter(row, col),
        isBlack,
        clueNumber: cellClueNumber,
      });
    }
    grid.push(rowCells);
  }

  return grid;
}

/**
 * Get a deterministic letter for a cell position
 */
function getTestLetter(row: number, col: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return letters[(row * 7 + col * 3) % 26];
}

/**
 * Generate black cell positions based on pattern
 */
function getBlackCellPositions(
  width: number,
  height: number,
  pattern: 'none' | 'standard' | 'symmetric'
): Set<string> {
  const blackCells = new Set<string>();

  if (pattern === 'none') {
    return blackCells;
  }

  if (pattern === 'symmetric') {
    // Create a symmetric pattern typical of crosswords
    // Place black cells at roughly 15% density with 180-degree rotational symmetry
    const density = 0.15;
    const totalCells = width * height;
    const targetBlackCells = Math.floor(totalCells * density);

    // Use deterministic positions for reproducibility
    let placed = 0;
    for (let row = 0; row < Math.ceil(height / 2); row++) {
      for (let col = 0; col < width && placed < targetBlackCells / 2; col++) {
        // Deterministic pattern based on position
        if ((row * 5 + col * 3) % 7 === 0) {
          blackCells.add(`${row},${col}`);
          // Add symmetric cell
          blackCells.add(`${height - 1 - row},${width - 1 - col}`);
          placed++;
        }
      }
    }
  } else {
    // 'standard' pattern - sparse black cells at edges and some interior
    // More predictable pattern for testing
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        // Black cells at specific positions based on grid size
        const isCornerish =
          (row === 0 || row === height - 1) &&
          (col === width - 1 || col === 0) &&
          width > 5;
        const isInterior =
          row > 2 &&
          row < height - 3 &&
          col > 2 &&
          col < width - 3 &&
          (row + col) % 5 === 0;

        if (isCornerish || isInterior) {
          blackCells.add(`${row},${col}`);
        }
      }
    }
  }

  return blackCells;
}

/**
 * Generate clues based on grid layout
 */
function generateClues(
  grid: Cell[][],
  width: number,
  height: number
): { across: Clue[]; down: Clue[] } {
  const across: Clue[] = [];
  const down: Clue[] = [];

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const cell = grid[row][col];
      if (cell.isBlack || !cell.clueNumber) continue;

      // Check for across word
      const startsAcross = col === 0 || grid[row][col - 1].isBlack;
      if (startsAcross && col < width - 1 && !grid[row][col + 1].isBlack) {
        const length = getWordLength(grid, row, col, 'across', width, height);
        if (length >= 2) {
          across.push({
            number: cell.clueNumber,
            direction: 'across',
            text: `Test clue ${cell.clueNumber}-Across (${length} letters)`,
            row,
            col,
            length,
          });
        }
      }

      // Check for down word
      const startsDown = row === 0 || grid[row - 1][col].isBlack;
      if (startsDown && row < height - 1 && !grid[row + 1][col].isBlack) {
        const length = getWordLength(grid, row, col, 'down', width, height);
        if (length >= 2) {
          down.push({
            number: cell.clueNumber,
            direction: 'down',
            text: `Test clue ${cell.clueNumber}-Down (${length} letters)`,
            row,
            col,
            length,
          });
        }
      }
    }
  }

  return { across, down };
}

/**
 * Get the length of a word starting at a position
 */
function getWordLength(
  grid: Cell[][],
  startRow: number,
  startCol: number,
  direction: 'across' | 'down',
  width: number,
  height: number
): number {
  let length = 0;
  let row = startRow;
  let col = startCol;

  while (
    row < height &&
    col < width &&
    !grid[row][col].isBlack
  ) {
    length++;
    if (direction === 'across') {
      col++;
    } else {
      row++;
    }
  }

  return length;
}

/**
 * Pre-defined test puzzles for common sizes
 */
export const TEST_PUZZLES = {
  /** 5x5 mini puzzle */
  mini: createTestPuzzle({ width: 5, height: 5, title: 'Mini Test Puzzle' }),
  /** 15x15 standard puzzle */
  standard: createTestPuzzle({ width: 15, height: 15, title: 'Standard Test Puzzle' }),
  /** 21x21 Sunday puzzle */
  sunday: createTestPuzzle({ width: 21, height: 21, title: 'Sunday Test Puzzle' }),
  /** 25x25 large puzzle */
  large: createTestPuzzle({ width: 25, height: 25, title: 'Large Test Puzzle' }),
};

/**
 * For E2E tests: expose puzzle generator to window object
 * Call this in test setup to make puzzles available globally
 */
export function exposeTestPuzzlesGlobally(): void {
  if (typeof window !== 'undefined') {
    (window as unknown as { __TEST_PUZZLES__: typeof TEST_PUZZLES; __createTestPuzzle__: typeof createTestPuzzle }).__TEST_PUZZLES__ = TEST_PUZZLES;
    (window as unknown as { __createTestPuzzle__: typeof createTestPuzzle }).__createTestPuzzle__ = createTestPuzzle;
  }
}
