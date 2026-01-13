import type { Puzzle, Cell } from '../types/puzzle';

/**
 * Sample 5x5 mini crossword puzzle for testing
 *
 * Grid layout (. = black cell):
 *
 *   0   1   2   3   4
 * +---+---+---+---+---+
 * | S | T | A | R | . |  0
 * +---+---+---+---+---+
 * | P | . | L | O | W |  1
 * +---+---+---+---+---+
 * | A | I | L | S | . |  2
 * +---+---+---+---+---+
 * | M | . | E | . | . |  3
 * +---+---+---+---+---+
 * | . | T | O | P | S |  4
 * +---+---+---+---+---+
 *
 * Across:
 * 1. STAR - Celestial body (4)
 * 4. LOW - Not high (3)
 * 5. AILS - Troubles (4)
 * 6. TOPS - Beats (4)
 *
 * Down:
 * 1. SPAM - Junk email (4)
 * 2. ALLEO - Not quite right (5) - column 2: A,L,L,E,O
 * 3. ROS - Paddle (3) - column 3: R,O,S
 */

/**
 * Creates the grid cells for the sample puzzle
 */
function createGrid(): Cell[][] {
  // Grid definition: null = white cell, '#' = black cell
  // Letters are the solution (we use null for user-facing grid)
  const layout = [
    ['S', 'T', 'A', 'R', '#'],
    ['P', '#', 'L', 'O', 'W'],
    ['A', 'I', 'L', 'S', '#'],
    ['M', '#', 'E', '#', '#'],
    ['#', 'T', 'O', 'P', 'S'],
  ];

  const grid: Cell[][] = [];

  // Track which cells need clue numbers
  // A cell gets a number if it starts an across or down word
  let clueNumber = 0;
  const clueNumbers: Map<string, number> = new Map();

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const isBlack = layout[row][col] === '#';
      if (!isBlack) {
        const startsAcross = col === 0 || layout[row][col - 1] === '#';
        const startsDown = row === 0 || layout[row - 1][col] === '#';

        // Check if this starts a word (must have at least 2 letters)
        const hasAcrossWord = startsAcross && col < 4 && layout[row][col + 1] !== '#';
        const hasDownWord = startsDown && row < 4 && layout[row + 1][col] !== '#';

        if (hasAcrossWord || hasDownWord) {
          clueNumber++;
          clueNumbers.set(`${row},${col}`, clueNumber);
        }
      }
    }
  }

  for (let row = 0; row < 5; row++) {
    const rowCells: Cell[] = [];
    for (let col = 0; col < 5; col++) {
      const isBlack = layout[row][col] === '#';
      const cellClueNumber = clueNumbers.get(`${row},${col}`);

      rowCells.push({
        row,
        col,
        letter: isBlack ? null : layout[row][col],
        isBlack,
        clueNumber: cellClueNumber,
      });
    }
    grid.push(rowCells);
  }

  return grid;
}

/**
 * Sample puzzle for testing the crossword grid
 */
export const samplePuzzle: Puzzle = {
  title: 'Sample Mini Crossword',
  author: 'Crossing Words',
  width: 5,
  height: 5,
  grid: createGrid(),
  clues: {
    across: [
      { number: 1, direction: 'across', text: 'Celestial body (See 1-Down)', row: 0, col: 0, length: 4 },
      { number: 4, direction: 'across', text: 'Not high (letters 2-3 of 2-Down)', row: 1, col: 2, length: 3 },
      { number: 5, direction: 'across', text: 'Troubles (letters 1-2 here spell a word)', row: 2, col: 0, length: 4 },
      { number: 6, direction: 'across', text: 'Beats', row: 4, col: 1, length: 4 },
    ],
    down: [
      { number: 1, direction: 'down', text: 'Junk email', row: 0, col: 0, length: 4 },
      { number: 2, direction: 'down', text: 'Not quite right', row: 0, col: 2, length: 5 },
      { number: 3, direction: 'down', text: 'Paddle', row: 0, col: 3, length: 3 },
    ],
  },
};
