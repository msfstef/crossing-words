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
 * Matches various phrasings:
 * - "the starred clues' answers"
 * - "starred answers"
 * - "starred entries"
 * - "each starred answer"
 * - "each starred clue's answer"
 * - "like each starred answer"
 * - "every starred entry"
 */
export const starredReferencePattern: PatternMatcher = createPatternMatcher({
  id: 'starred-reference',
  description: 'References to starred clue answers',
  category: 'theme-marker',
  highlightType: 'starred',
  priority: 20,
  // Match: [the/each/every/all] starred [clue's/clues'/clue] [answer/answers/entry/entries]
  // Also matches: starred answers, starred entries (without "clue")
  regex: /\b(?:the\s+|each\s+(?:of\s+(?:the\s+)?)?|every\s+|all\s+)?starred\s+(?:clues?['']?\s*)?(?:answers?|entr(?:y|ies))\b/gi,
  extractReferences: () => {
    // This pattern identifies that the clue references starred answers
    // but doesn't provide specific clue numbers (they are resolved dynamically)
    return [];
  },
});

/**
 * Theme hint with multiple clue references
 * Matches: "a hint to 17-, 23-, 39- and 53-Across"
 * Matches: "a hint to the ends of 17-, 26-, 40- and 50-Across"
 * Also matches: "a hint to the start of 18-, 24-, 41- or 51-Across" (with "or")
 */
export const themeHintMultiPattern: PatternMatcher = {
  id: 'theme-hint-multi',
  description: 'Theme hints referencing multiple clues (hint to 17-, 23-, and/or 48-Across)',
  category: 'theme-marker',
  highlightType: 'theme-hint',
  priority: 15,
  match(context: PatternContext): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const clueText = context.clueText;

    // Pattern: hint/clue/key to [optional: the ends/starts/letters of] N-, M-, and/or K-Across/Down
    const regex =
      /(?:hint|clue|key)\s+to\s+(?:the\s+)?(?:(?:ends?|starts?|beginnings?|letters?)\s+of\s+)?((?:\d+[-–,\s]+)+)(?:and|or)\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)/gi;

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

      // Add the last number (after "and" or "or")
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
 * Hint to starred clues (without explicit clue numbers)
 * Matches: "hint to the starred clues", "key to understanding the starred clues' answers"
 */
export const hintToStarredPattern: PatternMatcher = createPatternMatcher({
  id: 'hint-to-starred',
  description: 'Hint/key to starred clues',
  category: 'theme-marker',
  highlightType: 'starred',
  priority: 18,
  regex: /\b(?:hint|clue|key)\s+to\s+(?:understanding\s+)?(?:the\s+)?starred\b/gi,
  extractReferences: () => {
    // This pattern identifies that the clue is a hint to starred answers
    // Starred clues are resolved dynamically in buildClueReferenceMap
    return [];
  },
});

/**
 * Circled letters reference
 * Matches: "circled letters", "circled squares", "circled cells"
 * Matches: "each set of circled letters", "the circled letters"
 */
export const circledLettersPattern: PatternMatcher = createPatternMatcher({
  id: 'circled-letters',
  description: 'References to circled letters/squares in the grid',
  category: 'theme-marker',
  highlightType: 'theme-hint',
  priority: 15,
  regex: /\b(?:each\s+(?:set\s+of\s+)?|the\s+)?circled\s+(?:letters?|squares?|cells?)\b/gi,
  extractReferences: () => {
    // Circled cells would need puzzle metadata support
    // For now, this flags the clue as theme-related
    return [];
  },
});

/**
 * Shaded letters/squares reference
 * Matches: "shaded letters", "shaded squares", "highlighted squares"
 */
export const shadedLettersPattern: PatternMatcher = createPatternMatcher({
  id: 'shaded-letters',
  description: 'References to shaded/highlighted letters/squares in the grid',
  category: 'theme-marker',
  highlightType: 'theme-hint',
  priority: 15,
  regex: /\b(?:each\s+(?:set\s+of\s+)?|the\s+)?(?:shaded|highlighted)\s+(?:letters?|squares?|cells?|areas?)\b/gi,
  extractReferences: () => {
    // Shaded cells would need puzzle metadata support
    // For now, this flags the clue as theme-related
    return [];
  },
});

/**
 * Long/longest answers reference
 * Matches: "the long answers", "the longest entries", "the four longest answers"
 */
export const longAnswersPattern: PatternMatcher = createPatternMatcher({
  id: 'long-answers',
  description: 'References to the longest answers in the grid',
  category: 'theme-marker',
  highlightType: 'theme-hint',
  priority: 10,
  regex: /\bthe\s+(?:(?:four|five|six|seven|eight|three)\s+)?(?:long(?:est)?)\s+(?:answers?|entries?|clues?)\b/gi,
  extractReferences: () => {
    // Long answers would need to be calculated from puzzle data
    // For now, this flags the clue as theme-related
    return [];
  },
});

/**
 * All theme marker patterns in priority order.
 */
export const themeMarkerPatterns: PatternMatcher[] = [
  starredCluePattern,
  starredReferencePattern,
  hintToStarredPattern,
  themeHintMultiPattern,
  themeHintMarkerPattern,
  circledLettersPattern,
  shadedLettersPattern,
  longAnswersPattern,
];
