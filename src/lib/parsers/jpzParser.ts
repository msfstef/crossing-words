/**
 * Parser for .jpz crossword files
 * Uses xd-crossword-tools for XML parsing
 */

import { jpzToXD, xdToJSON } from 'xd-crossword-tools';
import type { Puzzle, Cell, Clue } from '../../types/puzzle';

/**
 * Parse a .jpz file buffer into our Puzzle format
 * @param buffer ArrayBuffer containing the .jpz file data
 * @returns Parsed Puzzle object
 * @throws Error if the file is invalid or malformed
 */
export function parseJpz(buffer: ArrayBuffer): Puzzle {
  if (!buffer || buffer.byteLength === 0) {
    throw new Error('Empty or invalid .jpz file');
  }

  // Convert buffer to UTF-8 string
  let xmlString: string;
  try {
    const decoder = new TextDecoder('utf-8');
    xmlString = decoder.decode(buffer);
  } catch (error) {
    throw new Error(
      `Failed to decode .jpz file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  if (!xmlString.trim()) {
    throw new Error('Empty .jpz file');
  }

  let xdString: string;
  try {
    xdString = jpzToXD(xmlString);
  } catch (error) {
    throw new Error(
      `Failed to parse .jpz file: ${error instanceof Error ? error.message : 'Unknown error'}`
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

  // Build the grid
  const grid: Cell[][] = [];
  for (let row = 0; row < height; row++) {
    const rowCells: Cell[] = [];
    for (let col = 0; col < width; col++) {
      const tile = json.tiles[row][col];
      const isBlack = tile.type === 'blank';
      let letter: string | null = null;
      let clueNumber: number | undefined = undefined;

      if (tile.type === 'letter') {
        letter = tile.letter;
        // Check if this cell has a clue number
        if (tile.clues?.across !== undefined) {
          clueNumber = tile.clues.across;
        } else if (tile.clues?.down !== undefined) {
          clueNumber = tile.clues.down;
        }
      } else if (tile.type === 'rebus') {
        // For rebus tiles, use the first letter as the solution
        letter = tile.word.charAt(0) || null;
        if (tile.clues?.across !== undefined) {
          clueNumber = tile.clues.across;
        } else if (tile.clues?.down !== undefined) {
          clueNumber = tile.clues.down;
        }
      }

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

  // Convert clues
  const acrossClues: Clue[] = json.clues.across.map((clue) => ({
    number: clue.number,
    direction: 'across' as const,
    text: clue.body,
    row: clue.position.col, // xd-crossword-tools uses col for row index
    col: clue.position.index,
    length: clue.tiles.length,
  }));

  const downClues: Clue[] = json.clues.down.map((clue) => ({
    number: clue.number,
    direction: 'down' as const,
    text: clue.body,
    row: clue.position.col, // xd-crossword-tools uses col for row index
    col: clue.position.index,
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
