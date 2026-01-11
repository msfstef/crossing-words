/**
 * Parser for .puz crossword files
 * Uses xd-crossword-tools for binary parsing
 */

import { puzToXD, xdToJSON } from 'xd-crossword-tools';
import type { Puzzle, Cell, Clue } from '../../types/puzzle';

/**
 * Parse a .puz file buffer into our Puzzle format
 * @param buffer ArrayBuffer containing the .puz file data
 * @returns Parsed Puzzle object
 * @throws Error if the file is invalid or malformed
 */
export function parsePuz(buffer: ArrayBuffer): Puzzle {
  if (!buffer || buffer.byteLength === 0) {
    throw new Error('Empty or invalid .puz file');
  }

  let xdString: string;
  try {
    xdString = puzToXD(buffer);
  } catch (error) {
    throw new Error(
      `Failed to parse .puz file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  let json;
  try {
    json = xdToJSON(xdString);
  } catch (error) {
    throw new Error(
      `Failed to convert puzzle data: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  if (!json.report.success) {
    const errors = json.report.errors.map((e) => e.message).join(', ');
    throw new Error(`Invalid puzzle format: ${errors}`);
  }

  return convertToPuzzle(json);
}

/**
 * Convert xd-crossword-tools JSON format to our Puzzle type
 */
function convertToPuzzle(json: ReturnType<typeof xdToJSON>): Puzzle {
  const height = json.tiles.length;
  const width = height > 0 ? json.tiles[0].length : 0;

  if (width === 0 || height === 0) {
    throw new Error('Invalid puzzle dimensions');
  }

  // Build a map of (row,col) -> clueNumber from clue positions
  // xd-crossword-tools position format: index = row, col = column
  const clueNumberMap = new Map<string, number>();
  for (const clue of json.clues.across) {
    const key = `${clue.position.index},${clue.position.col}`;
    clueNumberMap.set(key, clue.number);
  }
  for (const clue of json.clues.down) {
    const key = `${clue.position.index},${clue.position.col}`;
    // Only set if not already set by across (they share the same number)
    if (!clueNumberMap.has(key)) {
      clueNumberMap.set(key, clue.number);
    }
  }

  // Build the grid
  const grid: Cell[][] = [];
  for (let row = 0; row < height; row++) {
    const rowCells: Cell[] = [];
    for (let col = 0; col < width; col++) {
      const tile = json.tiles[row][col];
      const isBlack = tile.type === 'blank';
      let letter: string | null = null;

      if (tile.type === 'letter') {
        letter = tile.letter;
      } else if (tile.type === 'rebus') {
        // For rebus tiles, use the first letter as the solution
        letter = tile.word.charAt(0) || null;
      }

      // Look up clue number from the map we built
      const clueNumber = clueNumberMap.get(`${row},${col}`);

      rowCells.push({
        row,
        col,
        letter,
        isBlack,
        ...(clueNumber !== undefined && { clueNumber }),
      });
    }
    grid.push(rowCells);
  }

  // Convert clues - position.index is row, position.col is column
  const acrossClues: Clue[] = json.clues.across.map((clue) => ({
    number: clue.number,
    direction: 'across' as const,
    text: clue.body,
    row: clue.position.index,
    col: clue.position.col,
    length: clue.tiles.length,
  }));

  const downClues: Clue[] = json.clues.down.map((clue) => ({
    number: clue.number,
    direction: 'down' as const,
    text: clue.body,
    row: clue.position.index,
    col: clue.position.col,
    length: clue.tiles.length,
  }));

  return {
    title: json.meta.title || 'Untitled Puzzle',
    author: json.meta.author || undefined,
    grid,
    clues: {
      across: acrossClues,
      down: downClues,
    },
    width,
    height,
  };
}
