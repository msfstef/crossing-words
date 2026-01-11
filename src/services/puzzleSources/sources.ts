/**
 * Registry of available puzzle sources
 */

import type { PuzzleSource } from './types';

/**
 * Format date as YYMMDD for URL construction
 */
function formatDateYYMMDD(date: Date): string {
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

export const PUZZLE_SOURCES: PuzzleSource[] = [
  {
    id: 'universal',
    name: 'Universal Crossword',
    description: 'Daily puzzle from Andrews McMeel',
    format: 'puz',
    requiresAuth: false,
    availableDays: 'daily',
    getDirectUrl: (date: Date) => {
      const dateStr = formatDateYYMMDD(date);
      // Andrews McMeel syndication URL (same pattern as proxy uses)
      return `https://syndication.andrewsmcmeel.com/uupuz/${dateStr}/uclick/fc/fcx${dateStr}.puz`;
    },
  },
  // Additional sources can be added here
];

export function getSource(id: string): PuzzleSource | undefined {
  return PUZZLE_SOURCES.find((s) => s.id === id);
}
