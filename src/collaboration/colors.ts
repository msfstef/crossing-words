/**
 * Color assignment and nickname generation for collaborators.
 *
 * Uses distinct-colors library to pre-generate a palette that ensures
 * visual distinction between collaborators. Nicknames are auto-generated
 * using an adjective + animal pattern.
 *
 * Design decisions:
 * - Local user always gets a consistent indigo color for familiarity
 * - Red and green are excluded from the palette to avoid confusion
 *   with error/correct answer indicators
 */

import distinctColors from 'distinct-colors';
import chroma from 'chroma-js';

/**
 * Fixed color for the local/main player.
 * Always the same for consistency and familiarity.
 * Indigo is distinct from red/green UI indicators.
 */
export const LOCAL_USER_COLOR = '#6366f1';

/**
 * Check if a color's hue falls in the red or green range.
 * Red: 0-30° and 330-360°
 * Green: 80-160°
 */
function isRedOrGreen(hexColor: string): boolean {
  try {
    const hue = chroma(hexColor).get('hsl.h');
    // Red hues: 0-30 or 330-360
    const isRed = hue <= 30 || hue >= 330;
    // Green hues: 80-160
    const isGreen = hue >= 80 && hue <= 160;
    return isRed || isGreen;
  } catch {
    return false;
  }
}

/**
 * Pre-generated palette of visually distinct colors for collaborators.
 * - Excludes red and green to avoid confusion with correct/error indicators
 * - Uses chromaMin: 50 to avoid washed-out colors
 * - lightMin/lightMax ensure colors work on dark backgrounds
 */
const PALETTE = distinctColors({
  count: 30, // Generate more to account for filtering
  chromaMin: 50,
  lightMin: 35,
  lightMax: 75,
})
  .map((color) => color.hex())
  .filter((hex) => !isRedOrGreen(hex))
  .slice(0, 20); // Keep up to 20 colors after filtering

/**
 * Adjectives for nickname generation.
 * Chosen for positive, playful connotations.
 */
const ADJECTIVES = [
  'Clever',
  'Swift',
  'Bright',
  'Bold',
  'Curious',
  'Daring',
  'Eager',
  'Fierce',
  'Gentle',
  'Happy',
  'Jolly',
  'Keen',
  'Lively',
  'Merry',
  'Noble',
  'Plucky',
  'Quick',
  'Radiant',
  'Snappy',
  'Witty',
];

/**
 * Animals for nickname generation.
 * Chosen for familiarity and positive associations.
 */
const ANIMALS = [
  'Fox',
  'Owl',
  'Bear',
  'Wolf',
  'Hawk',
  'Deer',
  'Otter',
  'Lynx',
  'Hare',
  'Crane',
  'Raven',
  'Finch',
  'Badger',
  'Falcon',
  'Beaver',
  'Panda',
  'Koala',
  'Tiger',
  'Eagle',
  'Dove',
];

/**
 * Assigns a color to a client based on their ID.
 * Uses modulo to cycle through the palette for consistent assignment.
 *
 * @param clientId - The Yjs Awareness client ID
 * @returns Hex color string (e.g., "#ff6b6b")
 * @deprecated Use assignUniqueColor instead to avoid color collisions
 */
export function assignColor(clientId: number): string {
  const index = Math.abs(clientId) % PALETTE.length;
  return PALETTE[index];
}

/**
 * Assigns a unique color by checking what colors are already in use.
 * Falls back to hash-based assignment if all colors are taken.
 *
 * @param usedColors - Array of hex colors already in use by other clients
 * @param clientId - The client ID (used as fallback for hash-based assignment)
 * @returns Hex color string that isn't in usedColors (if possible)
 */
export function assignUniqueColor(usedColors: string[], clientId: number): string {
  // Normalize used colors to lowercase for comparison
  const usedSet = new Set(usedColors.map(c => c.toLowerCase()));

  // Find first unused color
  for (const color of PALETTE) {
    if (!usedSet.has(color.toLowerCase())) {
      return color;
    }
  }

  // All colors taken, fall back to hash-based (will collide, but rare with 12 colors)
  return assignColor(clientId);
}

/**
 * Generates a random nickname in "Adjective Animal" format.
 * Each call returns a new random combination.
 *
 * @returns Generated nickname (e.g., "Clever Fox", "Swift Owl")
 */
export function generateNickname(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adjective} ${animal}`;
}

/**
 * Export palette for testing or custom color needs.
 */
export { PALETTE };
