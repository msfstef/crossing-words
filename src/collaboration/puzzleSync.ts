/**
 * Puzzle sync module for CRDT-based puzzle sharing
 *
 * Stores puzzle metadata in a Y.Map("puzzle") within the Y.Doc,
 * enabling automatic sync of puzzle data to peers via y-webrtc.
 * This allows users who don't have a puzzle locally to receive it
 * when joining a shared session.
 */

import * as Y from 'yjs';
import type { Puzzle, Cell, Clue } from '../types/puzzle';

/**
 * Serialized puzzle format for CRDT storage.
 * Uses plain arrays instead of Cell[][] for JSON compatibility.
 */
interface SerializedPuzzle {
  title: string;
  author?: string;
  width: number;
  height: number;
  /** Flattened grid cells as JSON-serializable objects */
  grid: Array<{
    row: number;
    col: number;
    letter: string | null;
    isBlack: boolean;
    clueNumber?: number;
  }>;
  clues: {
    across: Clue[];
    down: Clue[];
  };
}

/** Key for puzzle metadata in Y.Doc */
const PUZZLE_MAP_KEY = 'puzzle';
/** Key for serialized puzzle data within the puzzle map */
const PUZZLE_DATA_KEY = 'data';

/**
 * Get or create the puzzle Y.Map from a Y.Doc.
 */
function getPuzzleMap(doc: Y.Doc): Y.Map<string> {
  return doc.getMap<string>(PUZZLE_MAP_KEY);
}

/**
 * Serialize a Puzzle object for CRDT storage.
 */
function serializePuzzle(puzzle: Puzzle): SerializedPuzzle {
  return {
    title: puzzle.title,
    author: puzzle.author,
    width: puzzle.width,
    height: puzzle.height,
    // Flatten the 2D grid for JSON serialization
    grid: puzzle.grid.flat().map((cell) => ({
      row: cell.row,
      col: cell.col,
      letter: cell.letter,
      isBlack: cell.isBlack,
      clueNumber: cell.clueNumber,
    })),
    clues: {
      across: puzzle.clues.across,
      down: puzzle.clues.down,
    },
  };
}

/**
 * Deserialize a puzzle from CRDT storage back to Puzzle type.
 */
function deserializePuzzle(serialized: SerializedPuzzle): Puzzle {
  // Reconstruct 2D grid from flat array
  const grid: Cell[][] = [];
  for (let row = 0; row < serialized.height; row++) {
    grid[row] = [];
    for (let col = 0; col < serialized.width; col++) {
      const cellIndex = row * serialized.width + col;
      const cell = serialized.grid[cellIndex];
      grid[row][col] = {
        row: cell.row,
        col: cell.col,
        letter: cell.letter,
        isBlack: cell.isBlack,
        clueNumber: cell.clueNumber,
      };
    }
  }

  return {
    title: serialized.title,
    author: serialized.author,
    width: serialized.width,
    height: serialized.height,
    grid,
    clues: serialized.clues,
  };
}

/**
 * Store puzzle metadata in the CRDT for sync to peers.
 *
 * This should be called by the session initiator (sharer) to make
 * the puzzle available to joining peers.
 *
 * @param doc - The Y.Doc to store puzzle in
 * @param puzzle - The puzzle to store
 */
export function setPuzzleInCrdt(doc: Y.Doc, puzzle: Puzzle): void {
  const puzzleMap = getPuzzleMap(doc);
  const serialized = serializePuzzle(puzzle);
  puzzleMap.set(PUZZLE_DATA_KEY, JSON.stringify(serialized));
  console.debug('[puzzleSync] Stored puzzle in CRDT:', puzzle.title);
}

/**
 * Retrieve puzzle metadata from the CRDT.
 *
 * Returns null if no puzzle has been stored yet.
 *
 * @param doc - The Y.Doc to read puzzle from
 * @returns The puzzle if present, null otherwise
 */
export function getPuzzleFromCrdt(doc: Y.Doc): Puzzle | null {
  const puzzleMap = getPuzzleMap(doc);
  const data = puzzleMap.get(PUZZLE_DATA_KEY);

  if (!data) {
    return null;
  }

  try {
    const serialized: SerializedPuzzle = JSON.parse(data);
    const puzzle = deserializePuzzle(serialized);
    console.debug('[puzzleSync] Retrieved puzzle from CRDT:', puzzle.title);
    return puzzle;
  } catch (err) {
    console.error('[puzzleSync] Failed to parse puzzle from CRDT:', err);
    return null;
  }
}

/**
 * Check if puzzle data exists in the CRDT.
 *
 * @param doc - The Y.Doc to check
 * @returns true if puzzle data is present
 */
export function hasPuzzleInCrdt(doc: Y.Doc): boolean {
  const puzzleMap = getPuzzleMap(doc);
  return puzzleMap.has(PUZZLE_DATA_KEY);
}

/**
 * Subscribe to puzzle changes in the CRDT.
 *
 * The callback is invoked whenever the puzzle data changes,
 * including when it's first received from a peer.
 *
 * @param doc - The Y.Doc to observe
 * @param callback - Called with the puzzle when it changes
 * @returns Unsubscribe function
 */
export function observePuzzleInCrdt(
  doc: Y.Doc,
  callback: (puzzle: Puzzle | null) => void
): () => void {
  const puzzleMap = getPuzzleMap(doc);

  const observer = () => {
    const puzzle = getPuzzleFromCrdt(doc);
    callback(puzzle);
  };

  puzzleMap.observe(observer);

  return () => {
    puzzleMap.unobserve(observer);
  };
}
