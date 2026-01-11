/**
 * Unified puzzle import module with format detection
 * Supports .puz, .ipuz, and .jpz crossword file formats
 */

import type { Puzzle } from '../types/puzzle';
import { parsePuz } from './parsers/puzParser';
import { parseIpuz } from './parsers/ipuzParser';
import { parseJpz } from './parsers/jpzParser';

/** Supported puzzle file formats */
export type PuzzleFormat = 'puz' | 'ipuz' | 'jpz';

/**
 * Magic bytes for .puz format verification
 * .puz files have "ACROSS&DOWN" at offset 2
 */
const PUZ_MAGIC = 'ACROSS&DOWN';
const PUZ_MAGIC_OFFSET = 2;

/**
 * Detect the format of a puzzle file
 * @param filename The name of the file (used for extension detection)
 * @param buffer The file contents as ArrayBuffer
 * @returns The detected format, or null if unrecognized
 */
export function detectFormat(
  filename: string,
  buffer: ArrayBuffer
): PuzzleFormat | null {
  const extension = getFileExtension(filename);

  // Check by extension first
  switch (extension) {
    case 'puz':
      // Verify magic bytes for .puz files
      if (verifyPuzMagic(buffer)) {
        return 'puz';
      }
      // Still return puz if extension matches, let parser handle errors
      return 'puz';

    case 'ipuz':
      return 'ipuz';

    case 'jpz':
      return 'jpz';

    default:
      // Try to detect by content if extension doesn't match
      if (verifyPuzMagic(buffer)) {
        return 'puz';
      }

      // Try to detect JSON (ipuz)
      try {
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(buffer);
        const trimmed = text.trim();
        if (trimmed.startsWith('{') && trimmed.includes('"kind"')) {
          return 'ipuz';
        }
        // Try to detect XML (jpz)
        if (trimmed.startsWith('<?xml') || trimmed.startsWith('<crossword-compiler')) {
          return 'jpz';
        }
      } catch {
        // Ignore decode errors
      }

      return null;
  }
}

/**
 * Import a puzzle file and convert it to our Puzzle format
 * @param file The File object to import
 * @returns Promise resolving to the parsed Puzzle
 * @throws Error if the format is not supported or parsing fails
 */
export async function importPuzzle(file: File): Promise<Puzzle> {
  if (!file) {
    throw new Error('No file provided');
  }

  const buffer = await file.arrayBuffer();
  const format = detectFormat(file.name, buffer);

  if (!format) {
    throw new Error(
      'Unsupported file format. Please use .puz, .ipuz, or .jpz files.'
    );
  }

  try {
    switch (format) {
      case 'puz':
        return parsePuz(buffer);

      case 'ipuz': {
        const decoder = new TextDecoder('utf-8');
        const jsonString = decoder.decode(buffer);
        return parseIpuz(jsonString);
      }

      case 'jpz':
        return parseJpz(buffer);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown parsing error';
    throw new Error(`Invalid puzzle file: ${message}`);
  }
}

/**
 * Extract file extension from filename (lowercase, without dot)
 */
function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length < 2) {
    return '';
  }
  return parts[parts.length - 1].toLowerCase();
}

/**
 * Verify that a buffer contains the .puz magic bytes
 */
function verifyPuzMagic(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < PUZ_MAGIC_OFFSET + PUZ_MAGIC.length) {
    return false;
  }

  try {
    const view = new Uint8Array(
      buffer,
      PUZ_MAGIC_OFFSET,
      PUZ_MAGIC.length
    );
    const decoder = new TextDecoder('ascii');
    const magic = decoder.decode(view);
    return magic === PUZ_MAGIC;
  } catch {
    return false;
  }
}
