/**
 * Parser for .ipuz crossword files
 * ipuz is a JSON-based format, so we parse directly without external libraries
 */

import type { Puzzle, Cell, Clue } from '../../types/puzzle';

/**
 * ipuz format types (subset relevant to crosswords)
 */
interface IpuzPuzzle {
  version?: string;
  kind?: string[];
  dimensions?: {
    width: number;
    height: number;
  };
  puzzle?: (IpuzCell | null)[][];
  solution?: (string | null | IpuzSolutionCell)[][];
  clues?: {
    Across?: IpuzClue[];
    Down?: IpuzClue[];
  };
  title?: string;
  author?: string;
  copyright?: string;
  publisher?: string;
  date?: string;
  notes?: string;
}

type IpuzCell = number | string | IpuzCellObject | '#' | 0;

interface IpuzCellObject {
  cell?: number;
  style?: {
    shapebg?: string;
  };
}

interface IpuzSolutionCell {
  value?: string;
}

type IpuzClue = [number, string] | IpuzClueObject;

interface IpuzClueObject {
  number: number;
  clue: string;
  answer?: string;
}

/**
 * Parse an ipuz JSON string into our Puzzle format
 * @param jsonString JSON string containing the ipuz puzzle data
 * @returns Parsed Puzzle object
 * @throws Error if the file is invalid or malformed
 */
export function parseIpuz(jsonString: string): Puzzle {
  if (!jsonString || jsonString.trim().length === 0) {
    throw new Error('Empty or invalid .ipuz file');
  }

  let ipuz: IpuzPuzzle;
  try {
    ipuz = JSON.parse(jsonString);
  } catch (error) {
    throw new Error(
      `Failed to parse .ipuz JSON: ${error instanceof Error ? error.message : 'Invalid JSON'}`
    );
  }

  // Validate required fields
  if (!ipuz.dimensions) {
    throw new Error('Invalid .ipuz file: missing dimensions');
  }

  const { width, height } = ipuz.dimensions;

  if (!width || !height || width <= 0 || height <= 0) {
    throw new Error('Invalid .ipuz file: invalid dimensions');
  }

  if (!ipuz.puzzle && !ipuz.solution) {
    throw new Error('Invalid .ipuz file: missing puzzle or solution grid');
  }

  // Build the grid
  const grid: Cell[][] = [];
  for (let row = 0; row < height; row++) {
    const rowCells: Cell[] = [];
    for (let col = 0; col < width; col++) {
      const puzzleCell = ipuz.puzzle?.[row]?.[col];
      const solutionCell = ipuz.solution?.[row]?.[col];

      const isBlack = isBlackCell(puzzleCell);
      const clueNumber = extractClueNumber(puzzleCell);
      const letter = extractLetter(solutionCell);

      rowCells.push({
        row,
        col,
        letter: isBlack ? null : letter,
        isBlack,
        ...(clueNumber !== undefined && { clueNumber }),
      });
    }
    grid.push(rowCells);
  }

  // Parse clues
  const acrossClues = parseClues(ipuz.clues?.Across || [], 'across', grid);
  const downClues = parseClues(ipuz.clues?.Down || [], 'down', grid);

  return {
    title: ipuz.title || 'Untitled Puzzle',
    author: ipuz.author || undefined,
    grid,
    clues: {
      across: acrossClues,
      down: downClues,
    },
    width,
    height,
  };
}

/**
 * Determine if a cell is a black (blocked) cell
 */
function isBlackCell(cell: IpuzCell | null | undefined): boolean {
  if (cell === null || cell === undefined) {
    return false;
  }
  if (cell === '#' || cell === 0) {
    return true;
  }
  return false;
}

/**
 * Extract clue number from a puzzle cell
 */
function extractClueNumber(cell: IpuzCell | null | undefined): number | undefined {
  if (cell === null || cell === undefined || cell === '#' || cell === 0) {
    return undefined;
  }
  if (typeof cell === 'number' && cell > 0) {
    return cell;
  }
  if (typeof cell === 'string') {
    const num = parseInt(cell, 10);
    return isNaN(num) || num <= 0 ? undefined : num;
  }
  if (typeof cell === 'object' && 'cell' in cell && typeof cell.cell === 'number' && cell.cell > 0) {
    return cell.cell;
  }
  return undefined;
}

/**
 * Extract letter from a solution cell
 */
function extractLetter(cell: string | null | IpuzSolutionCell | undefined): string | null {
  if (cell === null || cell === undefined) {
    return null;
  }
  if (typeof cell === 'string') {
    // Solution can be a single letter or '#' for black cells
    if (cell === '#' || cell === ':' || cell === '') {
      return null;
    }
    return cell.charAt(0).toUpperCase();
  }
  if (typeof cell === 'object' && 'value' in cell && cell.value) {
    return cell.value.charAt(0).toUpperCase();
  }
  return null;
}

/**
 * Parse clues array and calculate positions from the grid
 */
function parseClues(
  clues: IpuzClue[],
  direction: 'across' | 'down',
  grid: Cell[][]
): Clue[] {
  const result: Clue[] = [];

  for (const clue of clues) {
    const [number, text] = normalizeClue(clue);
    if (number === undefined || text === undefined) {
      continue;
    }

    // Find the position of this clue number in the grid
    const position = findCluePosition(number, grid);
    if (!position) {
      continue;
    }

    // Calculate the length of the answer
    const length = calculateClueLength(position.row, position.col, direction, grid);

    result.push({
      number,
      direction,
      text,
      row: position.row,
      col: position.col,
      length,
    });
  }

  return result;
}

/**
 * Normalize different clue formats to [number, text]
 */
function normalizeClue(clue: IpuzClue): [number | undefined, string | undefined] {
  if (Array.isArray(clue)) {
    return [clue[0], clue[1]];
  }
  if (typeof clue === 'object' && 'number' in clue && 'clue' in clue) {
    return [clue.number, clue.clue];
  }
  return [undefined, undefined];
}

/**
 * Find the grid position where a clue number appears
 */
function findCluePosition(
  clueNumber: number,
  grid: Cell[][]
): { row: number; col: number } | null {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (grid[row][col].clueNumber === clueNumber) {
        return { row, col };
      }
    }
  }
  return null;
}

/**
 * Calculate the length of a clue's answer based on grid structure
 */
function calculateClueLength(
  startRow: number,
  startCol: number,
  direction: 'across' | 'down',
  grid: Cell[][]
): number {
  let length = 0;
  let row = startRow;
  let col = startCol;

  while (
    row < grid.length &&
    col < grid[0].length &&
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
