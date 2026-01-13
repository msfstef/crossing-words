/**
 * Theme Marker Pattern Matchers
 *
 * These patterns identify theme-related clues:
 * - Starred clues: "*Toy block that anyone can play with?"
 * - Starred references: "the starred clues' answers"
 * - Theme hints: "a hint to 17-, 23-, and 48-Across"
 */

import type { PatternMatcher, ClueReference, PatternContext, PatternMatch } from '../../../types/clueReference';
import { createPatternMatcher, normalizeDirection, createReference } from '../helpers';

/**
 * Starred clue marker
 * Matches: clues starting with "*"
 */
export const starredCluePattern: PatternMatcher = {
  id: 'starred-clue',
  description: 'Clues marked with asterisk (*) as themed answers',
  category: 'theme-marker',
  highlightType: 'starred',
  priority: 30, // High priority to identify starred status early
  match(context: PatternContext): PatternMatch[] {
    if (context.clueText.startsWith('*')) {
      return [
        {
          matchedText: '*',
          textStart: 0,
          textEnd: 1,
          references: [], // Starred marker doesn't reference other clues
          highlightType: 'starred',
          patternId: 'starred-clue',
        },
      ];
    }
    return [];
  },
};

/**
 * Reference to starred clue answers
 * Matches: "the starred clues' answers", "starred answers"
 */
export const starredReferencePattern: PatternMatcher = createPatternMatcher({
  id: 'starred-reference',
  description: 'References to starred clue answers',
  category: 'theme-marker',
  highlightType: 'starred',
  priority: 20,
  regex: /\bstarred\s+(?:clues?['']?\s*)?answers?\b/gi,
  extractReferences: () => {
    // This pattern identifies that the clue references starred answers
    // but doesn't provide specific clue numbers (they need to be found separately)
    return [];
  },
});

/**
 * Theme hint with multiple clue references
 * Matches: "a hint to 17-, 23-, 39- and 53-Across"
 * Matches: "a hint to the ends of 17-, 26-, 40- and 50-Across"
 */
export const themeHintMultiPattern: PatternMatcher = {
  id: 'theme-hint-multi',
  description: 'Theme hints referencing multiple clues (hint to 17-, 23-, and 48-Across)',
  category: 'theme-marker',
  highlightType: 'theme-hint',
  priority: 15,
  match(context: PatternContext): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const clueText = context.clueText;

    // Pattern: hint/clue/key to [optional: the ends/starts/letters of] N-, M-, and K-Across/Down
    const regex =
      /(?:hint|clue|key)\s+to\s+(?:the\s+)?(?:(?:ends?|starts?|beginnings?|letters?)\s+of\s+)?((?:\d+[-–,\s]+)+)and\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)/gi;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(clueText)) !== null) {
      const direction = normalizeDirection(match[3]);
      const references: ClueReference[] = [];

      // Extract all numbers from the prefix
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

      matches.push({
        matchedText: match[0],
        textStart: match.index,
        textEnd: match.index + match[0].length,
        references,
        highlightType: 'theme-hint',
        patternId: 'theme-hint-multi',
      });
    }

    return matches;
  },
};

/**
 * Generic theme hint marker
 * Matches: "and a theme hint", "or a theme hint"
 */
export const themeHintMarkerPattern: PatternMatcher = createPatternMatcher({
  id: 'theme-hint-marker',
  description: 'Generic theme hint marker (... and a theme hint)',
  category: 'theme-marker',
  highlightType: 'theme-hint',
  priority: 5,
  regex: /(?:and|or)\s+a\s+theme\s+hint\b/gi,
  extractReferences: () => {
    // This pattern identifies that the clue contains a theme hint
    // but doesn't provide specific clue numbers
    return [];
  },
});

/**
 * All theme marker patterns in priority order.
 */
export const themeMarkerPatterns: PatternMatcher[] = [
  starredCluePattern,
  starredReferencePattern,
  themeHintMultiPattern,
  themeHintMarkerPattern,
];
