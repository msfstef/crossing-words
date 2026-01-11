/**
 * Registry of available puzzle sources
 */

import type { PuzzleSource } from './types';

export const PUZZLE_SOURCES: PuzzleSource[] = [
  {
    id: 'universal',
    name: 'Universal Crossword',
    description: 'Daily puzzle from Andrews McMeel',
    format: 'puz',
    requiresAuth: false,
    availableDays: 'daily',
  },
  // Add LA Times when proxy supports it
];

export function getSource(id: string): PuzzleSource | undefined {
  return PUZZLE_SOURCES.find((s) => s.id === id);
}
