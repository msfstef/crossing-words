/**
 * Types for puzzle source configuration
 */

export interface PuzzleSource {
  id: string;
  name: string;
  description: string;
  format: 'puz' | 'jpz' | 'ipuz';
  requiresAuth: boolean;
  availableDays: 'daily' | 'weekdays' | 'weekdays-only' | 'sunday-only' | 'thursday-only';
  /** If true, skip direct fetch and use proxy immediately (for CORS-blocked sources) */
  requiresProxy: boolean;
  /** Construct direct URL for a given date (for direct fetch attempt) */
  getDirectUrl: (date: Date) => string;
}
