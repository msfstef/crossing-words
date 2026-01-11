/**
 * Types for puzzle source configuration
 */

export interface PuzzleSource {
  id: string;
  name: string;
  description: string;
  format: 'puz' | 'jpz' | 'ipuz';
  requiresAuth: boolean;
  availableDays: 'daily' | 'weekdays' | 'sunday-only';
  /** Construct direct URL for a given date (for direct fetch attempt) */
  getDirectUrl: (date: Date) => string;
}
