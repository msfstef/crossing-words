import type { Puzzle, Cell, Clue } from '../types/puzzle';

/**
 * Options for generating test puzzles of arbitrary sizes
 */
export interface TestPuzzleOptions {
  width: number;
  height: number;
  title?: string;
  author?: string;
  /**
   * Pattern for black cells:
   * - 'none': All white cells (for simple layout testing)
   * - 'standard': Sparse black cells at edges and some interior
   * - 'symmetric': 180-degree rotational symmetry (typical crossword)
   * - 'dense': Higher density of black cells (~25%)
   * - 'minimal': Only corner black cells (for testing edge cases)
   */
  blackCellPattern?: 'none' | 'standard' | 'symmetric' | 'dense' | 'minimal';
  /**
   * Seed for deterministic random generation.
   * Same seed produces same puzzle for reproducible tests.
   */
  seed?: number;
  /**
   * Percentage of cells to pre-fill (0-100).
   * Useful for testing partial completion states.
   */
  prefillPercent?: number;
  /**
   * Custom clue text generator.
   * If not provided, uses default "Test clue N-Direction (L letters)"
   */
  clueTextGenerator?: (clueNumber: number, direction: 'across' | 'down', length: number) => string;
}

/**
 * Simple seeded pseudo-random number generator (mulberry32).
 * Provides deterministic random numbers for reproducible tests.
 */
function seededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
    seed = 12345,
    prefillPercent = 0,
    clueTextGenerator,
  } = options;

  const random = seededRandom(seed);
  const grid = createGrid(width, height, blackCellPattern, random);
  const clues = generateClues(grid, width, height, clueTextGenerator);

  // Calculate pre-filled entries based on prefillPercent
  const prefilledEntries = new Map<string, string>();
  if (prefillPercent > 0) {
    const whiteCells: Array<{ row: number; col: number; letter: string }> = [];
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const cell = grid[row][col];
        if (!cell.isBlack && cell.letter) {
          whiteCells.push({ row, col, letter: cell.letter });
        }
      }
    }
    const cellsToFill = Math.floor(whiteCells.length * (prefillPercent / 100));
    // Shuffle with seeded random for deterministic selection
    for (let i = whiteCells.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [whiteCells[i], whiteCells[j]] = [whiteCells[j], whiteCells[i]];
    }
    for (let i = 0; i < cellsToFill; i++) {
      const cell = whiteCells[i];
      prefilledEntries.set(`${cell.row},${cell.col}`, cell.letter);
    }
  }

  const puzzle: Puzzle & { prefilledEntries?: Map<string, string> } = {
    title,
    author,
    width,
    height,
    grid,
    clues,
  };

  // Attach prefilled entries for tests to use
  if (prefilledEntries.size > 0) {
    puzzle.prefilledEntries = prefilledEntries;
  }

  return puzzle;
}

/**
 * Create grid cells with optional black cell patterns
 */
function createGrid(
  width: number,
  height: number,
  pattern: 'none' | 'standard' | 'symmetric' | 'dense' | 'minimal',
  random: () => number
): Cell[][] {
  const grid: Cell[][] = [];
  const blackCells = getBlackCellPositions(width, height, pattern, random);

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
  pattern: 'none' | 'standard' | 'symmetric' | 'dense' | 'minimal',
  random: () => number
): Set<string> {
  const blackCells = new Set<string>();

  if (pattern === 'none') {
    return blackCells;
  }

  if (pattern === 'minimal') {
    // Only corners for small grids, useful for testing edge cases
    if (width > 3 && height > 3) {
      blackCells.add('0,0');
      blackCells.add(`0,${width - 1}`);
      blackCells.add(`${height - 1},0`);
      blackCells.add(`${height - 1},${width - 1}`);
    }
    return blackCells;
  }

  if (pattern === 'symmetric') {
    // Create a symmetric pattern typical of crosswords
    // Place black cells at roughly 15% density with 180-degree rotational symmetry
    const density = 0.15;
    const totalCells = width * height;
    const targetBlackCells = Math.floor(totalCells * density);

    // Use seeded random for deterministic but varied placement
    let placed = 0;
    const candidates: Array<[number, number]> = [];

    // Collect candidates from top half
    for (let row = 0; row < Math.ceil(height / 2); row++) {
      for (let col = 0; col < width; col++) {
        candidates.push([row, col]);
      }
    }

    // Shuffle candidates with seeded random
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // Place black cells with symmetry
    for (const [row, col] of candidates) {
      if (placed >= targetBlackCells / 2) break;
      // Skip edges to maintain connectivity
      if (row === 0 && col === 0) continue;
      if (row === 0 && col === width - 1) continue;

      blackCells.add(`${row},${col}`);
      blackCells.add(`${height - 1 - row},${width - 1 - col}`);
      placed++;
    }
  } else if (pattern === 'dense') {
    // Higher density pattern (~25%) for testing crowded grids
    const density = 0.25;
    const totalCells = width * height;
    const targetBlackCells = Math.floor(totalCells * density);

    let placed = 0;
    for (let row = 0; row < height && placed < targetBlackCells; row++) {
      for (let col = 0; col < width && placed < targetBlackCells; col++) {
        // Use random but ensure we don't block all paths
        if (random() < density && !isEssentialCell(row, col, width, height)) {
          blackCells.add(`${row},${col}`);
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
 * Check if a cell is essential for maintaining word connectivity.
 * Used to avoid creating isolated cells or blocking all paths.
 */
function isEssentialCell(row: number, col: number, width: number, height: number): boolean {
  // First row and column are essential for word starts
  if (row === 0 && col < 3) return true;
  if (col === 0 && row < 3) return true;
  // Last row and column end points
  if (row === height - 1 && col > width - 3) return true;
  if (col === width - 1 && row > height - 3) return true;
  return false;
}

/**
 * Generate clues based on grid layout
 */
function generateClues(
  grid: Cell[][],
  width: number,
  height: number,
  clueTextGenerator?: (clueNumber: number, direction: 'across' | 'down', length: number) => string
): { across: Clue[]; down: Clue[] } {
  const across: Clue[] = [];
  const down: Clue[] = [];

  const getClueText = clueTextGenerator ?? ((num, dir, len) => `Test clue ${num}-${dir === 'across' ? 'Across' : 'Down'} (${len} letters)`);

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
            text: getClueText(cell.clueNumber, 'across', length),
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
            text: getClueText(cell.clueNumber, 'down', length),
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
 * Pre-defined test puzzles for common sizes.
 * Each puzzle is deterministically generated for reproducible tests.
 */
export const TEST_PUZZLES = {
  /** 5x5 mini puzzle - quick tests */
  mini: createTestPuzzle({ width: 5, height: 5, title: 'Mini Test Puzzle' }),
  /** 15x15 standard puzzle - typical daily crossword */
  standard: createTestPuzzle({ width: 15, height: 15, title: 'Standard Test Puzzle' }),
  /** 21x21 Sunday puzzle - larger format */
  sunday: createTestPuzzle({ width: 21, height: 21, title: 'Sunday Test Puzzle' }),
  /** 25x25 large puzzle - stress testing */
  large: createTestPuzzle({ width: 25, height: 25, title: 'Large Test Puzzle' }),
  /** 5x5 with no black cells - simple grid testing */
  miniNoBlack: createTestPuzzle({ width: 5, height: 5, title: 'Mini No Black', blackCellPattern: 'none' }),
  /** 15x15 with symmetric pattern - realistic layout */
  standardSymmetric: createTestPuzzle({ width: 15, height: 15, title: 'Standard Symmetric', blackCellPattern: 'symmetric' }),
  /** 15x15 with dense black cells - crowded grid testing */
  standardDense: createTestPuzzle({ width: 15, height: 15, title: 'Standard Dense', blackCellPattern: 'dense' }),
  /** 15x15 with 50% prefilled - partial completion testing */
  standardHalfFilled: createTestPuzzle({ width: 15, height: 15, title: 'Standard Half-Filled', prefillPercent: 50 }),
  /** 21x21 with 80% prefilled - near-completion testing */
  sundayNearComplete: createTestPuzzle({ width: 21, height: 21, title: 'Sunday Near Complete', prefillPercent: 80 }),
  /** 15x15 with very long clues - font sizing testing */
  longClues: createTestPuzzle({
    width: 15,
    height: 15,
    title: 'Long Clues Test',
    clueTextGenerator: (num, dir, len) => {
      // Generate progressively longer clues for testing font scaling
      if (num === 1) {
        return 'This is an extraordinarily verbose and needlessly lengthy clue description that would definitely overflow any reasonable clue bar if not properly handled with dynamic font sizing that progressively reduces text size';
      }
      if (num === 2) {
        return 'Another exceptionally long clue that tests font scaling to ensure all text remains visible without truncation or ellipsis while keeping the clue bar at a fixed height';
      }
      if (num <= 5) {
        return `A moderately long clue for testing the intermediate font sizes that sit between the default and minimum values (${len} letters)`;
      }
      return `Test clue ${num}-${dir === 'across' ? 'Across' : 'Down'} (${len} letters)`;
    },
  }),
};

/** Type for pre-defined puzzle names */
export type TestPuzzleName = keyof typeof TEST_PUZZLES;

/** All available test puzzle names */
export const TEST_PUZZLE_NAMES = Object.keys(TEST_PUZZLES) as TestPuzzleName[];

/**
 * Global type declarations for test utilities.
 * These are exposed on window when dev tools are initialized.
 */
declare global {
  interface Window {
    /** Pre-defined test puzzles */
    __TEST_PUZZLES__?: typeof TEST_PUZZLES;
    /** Function to create custom test puzzles */
    __createTestPuzzle__?: typeof createTestPuzzle;
    /** Currently loaded test puzzle (for E2E inspection) */
    __CURRENT_TEST_PUZZLE__?: Puzzle;
    /** Function to load a test puzzle by name */
    __loadTestPuzzle__?: (name: TestPuzzleName) => void;
    /** Test puzzle generator options type (for documentation) */
    __TestPuzzleOptions__?: TestPuzzleOptions;
  }
}

/**
 * Parse URL parameters to check for test puzzle requests.
 * Supports: ?testPuzzle=mini, ?testPuzzle=standard, etc.
 * Also supports custom dimensions: ?testPuzzle=custom&width=10&height=10
 *
 * @returns The puzzle name or custom options if found, null otherwise
 */
export function getTestPuzzleFromUrl(): TestPuzzleName | TestPuzzleOptions | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const puzzleName = params.get('testPuzzle');

  if (!puzzleName) return null;

  // Check for pre-defined puzzle
  if (puzzleName in TEST_PUZZLES) {
    return puzzleName as TestPuzzleName;
  }

  // Check for custom dimensions
  if (puzzleName === 'custom') {
    const width = parseInt(params.get('width') ?? '15', 10);
    const height = parseInt(params.get('height') ?? '15', 10);
    const pattern = params.get('pattern') as TestPuzzleOptions['blackCellPattern'] ?? 'standard';
    const prefill = parseInt(params.get('prefill') ?? '0', 10);

    return {
      width: Math.max(3, Math.min(50, width)),
      height: Math.max(3, Math.min(50, height)),
      title: `Custom ${width}x${height} Test Puzzle`,
      blackCellPattern: pattern,
      prefillPercent: Math.max(0, Math.min(100, prefill)),
    };
  }

  return null;
}

/**
 * Generate a URL for loading a specific test puzzle.
 *
 * @param name - Pre-defined puzzle name or 'custom'
 * @param options - Custom options when name is 'custom'
 * @returns URL string with test puzzle parameters
 */
export function buildTestPuzzleUrl(
  name: TestPuzzleName | 'custom',
  options?: Partial<TestPuzzleOptions>
): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';

  if (name !== 'custom') {
    return `${baseUrl}?testPuzzle=${name}`;
  }

  const params = new URLSearchParams();
  params.set('testPuzzle', 'custom');
  if (options?.width) params.set('width', options.width.toString());
  if (options?.height) params.set('height', options.height.toString());
  if (options?.blackCellPattern) params.set('pattern', options.blackCellPattern);
  if (options?.prefillPercent) params.set('prefill', options.prefillPercent.toString());

  return `${baseUrl}?${params.toString()}`;
}

/**
 * For E2E tests and dev mode: expose puzzle generator to window object.
 * Call this in dev mode to make puzzles available globally.
 *
 * After calling this, you can use in browser console:
 * - window.__TEST_PUZZLES__.mini - Get mini puzzle
 * - window.__createTestPuzzle__({ width: 10, height: 10 }) - Create custom puzzle
 * - window.__loadTestPuzzle__('standard') - Load and render a test puzzle
 */
export function exposeTestPuzzlesGlobally(): void {
  if (typeof window === 'undefined') return;

  window.__TEST_PUZZLES__ = TEST_PUZZLES;
  window.__createTestPuzzle__ = createTestPuzzle;

  // Log available commands in dev mode
  if (import.meta.env.DEV) {
    console.log(
      '%c[Test Puzzles] Dev tools initialized',
      'color: #4CAF50; font-weight: bold'
    );
    console.log('Available test puzzles:', TEST_PUZZLE_NAMES.join(', '));
    console.log('Usage:');
    console.log('  - window.__TEST_PUZZLES__.mini');
    console.log('  - window.__createTestPuzzle__({ width: 10, height: 10 })');
    console.log('  - Add ?testPuzzle=standard to URL');
    console.log('  - Add ?testPuzzle=custom&width=10&height=10 for custom size');
  }
}

/**
 * Check if running in dev/test mode where test puzzles should be available.
 */
export function isDevMode(): boolean {
  return import.meta.env.DEV || import.meta.env.MODE === 'test';
}
