/**
 * Direct Reference Pattern Matchers
 *
 * These patterns match explicit references to other clues:
 * - "See 17-Across"
 * - "With 9-Down, ..."
 * - "20-Down's province"
 * - "after saying 33-Across"
 * - Standard inline references "17-Across", "21D"
 * - Multi-clue references "17-, 23-, and 48-Across"
 */

import type { PatternMatcher, ClueReference } from '../../../types/clueReference';
import { createPatternMatcher, normalizeDirection, createReference } from '../helpers';

/**
 * "See N-Across/Down" pattern
 * Matches: "See 17-Across", "See 21-Down", "See 17A", "See 21D"
 */
export const seeReferencePattern: PatternMatcher = createPatternMatcher({
  id: 'see-reference',
  description: 'Direct "See N-Across/Down" style references',
  category: 'direct-reference',
  highlightType: 'whole-clue',
  priority: 10,
  regex: /\b[Ss]ee\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi,
  extractReferences: (match) => {
    const clueNumber = parseInt(match[1], 10);
    const direction = normalizeDirection(match[2]);
    return [createReference(clueNumber, direction, match.index, match.index + match[0].length)];
  },
});

/**
 * "With N-Across/Down, ..." combined clue pattern
 * Matches: "With 9-Down, power whose source goes down regularly"
 */
export const withReferencePattern: PatternMatcher = createPatternMatcher({
  id: 'with-reference',
  description: '"With N-Across/Down, ..." combined clue references',
  category: 'direct-reference',
  highlightType: 'whole-clue',
  priority: 10,
  regex: /\b[Ww]ith\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\s*,/gi,
  extractReferences: (match) => {
    const clueNumber = parseInt(match[1], 10);
    const direction = normalizeDirection(match[2]);
    return [createReference(clueNumber, direction, match.index, match.index + match[0].length)];
  },
});

/**
 * "N-Across's" or "N-Down's" possessive pattern
 * Matches: "20-Down's prov.", "17-Across's answer"
 */
export const possessiveReferencePattern: PatternMatcher = createPatternMatcher({
  id: 'possessive-reference',
  description: '"N-Across\'s" or "N-Down\'s" possessive form',
  category: 'direct-reference',
  highlightType: 'whole-clue',
  priority: 10,
  regex: /(\d+)\s*[-–]?\s*(Across|Down|A|D)['']s\b/gi,
  extractReferences: (match) => {
    const clueNumber = parseInt(match[1], 10);
    const direction = normalizeDirection(match[2]);
    return [createReference(clueNumber, direction, match.index, match.index + match[0].length)];
  },
});

/**
 * "after saying N-Across" pattern
 * Matches: "Bride's title, after saying 33-Across"
 */
export const afterSayingPattern: PatternMatcher = createPatternMatcher({
  id: 'after-saying',
  description: '"After saying N-Across" style reference',
  category: 'direct-reference',
  highlightType: 'whole-clue',
  priority: 10,
  regex: /\bafter\s+saying\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi,
  extractReferences: (match) => {
    const clueNumber = parseInt(match[1], 10);
    const direction = normalizeDirection(match[2]);
    return [createReference(clueNumber, direction, match.index, match.index + match[0].length)];
  },
});

/**
 * Multi-clue references with shared direction
 * Matches: "17-, 23-, 39- and 53-Across", "5-, 7- and 32-Down"
 */
export const multiClueReferencePattern: PatternMatcher = createPatternMatcher({
  id: 'multi-clue-reference',
  description: 'Multiple clues with shared direction (17-, 23-, and 48-Across)',
  category: 'direct-reference',
  highlightType: 'whole-clue',
  priority: 15, // Higher priority to match before inline references
  regex: /((?:\d+[-–,\s]+)+)and\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)/gi,
  extractReferences: (match) => {
    const direction = normalizeDirection(match[3]);
    const references: ClueReference[] = [];

    // Extract all numbers from the prefix (e.g., "17-, 23-, 39-")
    const prefixNumbers = match[1].match(/\d+/g) || [];
    for (const numStr of prefixNumbers) {
      references.push(
        createReference(parseInt(numStr, 10), direction, match.index, match.index + match[0].length)
      );
    }

    // Add the last number (after "and")
    references.push(
      createReference(parseInt(match[2], 10), direction, match.index, match.index + match[0].length)
    );

    return references;
  },
});

/**
 * Standard inline clue reference (catch-all)
 * Matches: "17-Across", "21-Down", "17A", "21D", "17 across", "21 down"
 * Lower priority - matched after more specific patterns
 */
export const inlineReferencePattern: PatternMatcher = createPatternMatcher({
  id: 'inline-reference',
  description: 'Any inline clue reference (N-Across or N-Down)',
  category: 'direct-reference',
  highlightType: 'whole-clue',
  priority: 0, // Lowest priority - catch-all
  regex: /\b(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi,
  extractReferences: (match) => {
    const clueNumber = parseInt(match[1], 10);
    const direction = normalizeDirection(match[2]);
    return [createReference(clueNumber, direction, match.index, match.index + match[0].length)];
  },
});

/**
 * All direct reference patterns in priority order.
 */
export const directReferencePatterns: PatternMatcher[] = [
  multiClueReferencePattern,
  seeReferencePattern,
  withReferencePattern,
  possessiveReferencePattern,
  afterSayingPattern,
  inlineReferencePattern,
];
