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
}
