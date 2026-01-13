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
      // Martin Herbach's .puz archive (reliable source for Universal crossword)
      return `https://herbach.dnsalias.com/uc/uc${dateStr}.puz`;
    },
  },
  {
    id: 'wapo-sunday',
    name: 'Washington Post Sunday',
    description: 'Sunday puzzle edited by Evan Birnholz',
    format: 'puz',
    requiresAuth: false,
    availableDays: 'sunday-only',
    getDirectUrl: (date: Date) => {
      const dateStr = formatDateYYMMDD(date);
      // Martin Herbach's .puz archive for Washington Post Sunday crossword
      return `https://herbach.dnsalias.com/WaPo/wp${dateStr}.puz`;
    },
  },
  {
    id: 'wsj',
    name: 'Wall Street Journal',
    description: 'Daily puzzle edited by Mike Shenk (Mon-Sat)',
    format: 'puz',
    requiresAuth: false,
    availableDays: 'weekdays-only',
    getDirectUrl: (date: Date) => {
      const dateStr = formatDateYYMMDD(date);
      // Martin Herbach's .puz archive for WSJ crossword
      return `https://herbach.dnsalias.com/wsj/wsj${dateStr}.puz`;
    },
  },
  {
    id: 'universal-sunday',
    name: 'Universal Sunday',
    description: 'Sunday puzzle from Andrews McMeel (21x21)',
    format: 'puz',
    requiresAuth: false,
    availableDays: 'sunday-only',
    getDirectUrl: (date: Date) => {
      const dateStr = formatDateYYMMDD(date);
      // Martin Herbach's .puz archive for Universal Sunday crossword
      return `https://herbach.dnsalias.com/uc/ucs${dateStr}.puz`;
    },
  },
  {
    id: 'jonesin',
    name: "Jonesin' Crossword",
    description: 'Weekly puzzle by Matt Jones (Thursday)',
    format: 'puz',
    requiresAuth: false,
    availableDays: 'thursday-only',
    getDirectUrl: (date: Date) => {
      const dateStr = formatDateYYMMDD(date);
      // Martin Herbach's .puz archive for Jonesin' crossword
      return `https://herbach.dnsalias.com/Jonesin/jz${dateStr}.puz`;
    },
  },
];

export function getSource(id: string): PuzzleSource | undefined {
  return PUZZLE_SOURCES.find((s) => s.id === id);
}
