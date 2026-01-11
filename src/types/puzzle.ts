/**
 * Crossword puzzle data model types
 */

/**
 * Represents a single cell in the crossword grid
 */
export interface Cell {
  row: number;
  col: number;
  letter: string | null;
  isBlack: boolean;
  clueNumber?: number;
}

/**
 * Represents a clue for the crossword puzzle
 */
export interface Clue {
  number: number;
  direction: 'across' | 'down';
  text: string;
  row: number;
  col: number;
  length: number;
}

/**
 * Represents the complete puzzle definition
 */
export interface Puzzle {
  title: string;
  author?: string;
  grid: Cell[][];
  clues: {
    across: Clue[];
    down: Clue[];
  };
  width: number;
  height: number;
}

/**
 * Represents the current state of puzzle solving
 * userEntries uses "row,col" format as key for easy lookup
 */
export interface PuzzleState {
  puzzle: Puzzle;
  userEntries: Map<string, string>;
  selectedCell: { row: number; col: number } | null;
  direction: 'across' | 'down';
}
