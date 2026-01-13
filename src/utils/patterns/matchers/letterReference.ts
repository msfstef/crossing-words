/**
 * Letter Reference Pattern Matchers
 *
 * These patterns match references to specific letter positions:
 * - "(... 3rd letter)" - single letter within current answer
 * - "(... letters 4-8)" - letter range within current answer
 * - "Letters 6-7 here + letters 2-1 of 21-Across" - cross-clue combination
 */

import type { PatternMatcher, ClueReference, PatternContext } from '../../../types/clueReference';
import { createPatternMatcher, normalizeDirection, createReference } from '../helpers';

/**
 * Self-reference single letter position
 * Matches: "(In this answer, note the 6th letter)", "(... 3rd letter)"
 * Does NOT match: "last N letters", "first N letters" (those are answer-spanning)
 */
export const selfLetterSinglePattern: PatternMatcher = createPatternMatcher({
  id: 'self-letter-single',
  description: 'Letter position reference within same answer (Nth letter)',
  category: 'letter-reference',
  highlightType: 'letter-range',
  priority: 20,
  // Negative lookbehind to avoid matching "last N" or "first N" patterns
  regex: /(?:\.\.\.|…)?\s*\(?(?:[Nn]ote\s+)?(?:the\s+)?(?<!last\s)(?<!first\s)(\d+)(?:st|nd|rd|th)?\s+letter(?:\s+here)?(?!\s*\+)\)?/gi,
  extractReferences: (match, context) => {
    const letterPos = parseInt(match[1], 10);
    return [
      createReference(
        context.currentClueNumber,
        context.currentDirection,
        match.index,
        match.index + match[0].length,
        { start: letterPos, end: letterPos }
      ),
    ];
  },
});

/**
 * Self-reference letter range
 * Matches: "(In this answer, note letters 4-8)", "(... letters 2-6)", "letters 1-2 here"
 * Does NOT match when followed by "of N-Across/Down" (that's external reference)
 */
export const selfLetterRangePattern: PatternMatcher = createPatternMatcher({
  id: 'self-letter-range',
  description: 'Letter range reference within same answer (letters N-M)',
  category: 'letter-reference',
  highlightType: 'letter-range',
  priority: 20,
  // Negative lookahead to avoid matching "letters 2-3 of 2-Down" (external reference)
  regex: /(?:\.\.\.|…)?\s*\(?(?:[Nn]ote\s+)?(?:the\s+)?letters?\s+(\d+)\s*[-–]\s*(\d+)(?:\s+here)?(?!\s+of\s+\d+\s*[-–]?\s*(?:Across|Down|A|D))\)?/gi,
  extractReferences: (match, context) => {
    const startLetter = parseInt(match[1], 10);
    const endLetter = parseInt(match[2], 10);
    // Handle reversed ranges (e.g., "letters 7-11" or "letters 11-7")
    const actualStart = Math.min(startLetter, endLetter);
    const actualEnd = Math.max(startLetter, endLetter);

    return [
      createReference(
        context.currentClueNumber,
        context.currentDirection,
        match.index,
        match.index + match[0].length,
        { start: actualStart, end: actualEnd }
      ),
    ];
  },
});

/**
 * Cross-clue letter combination
 * Matches: "Letters 6-7 here + letters 2-1 of 21-Across"
 * Matches: "(Note letters 2-3 of this answer + letters 3-2 of 14-Across)"
 */
export const crossClueLettersPattern: PatternMatcher = {
  id: 'cross-clue-letters',
  description: 'Letter combination across clues (Letters N-M here + letters X-Y of N-Across)',
  category: 'letter-reference',
  highlightType: 'letter-range',
  priority: 25, // Higher priority than simple letter references
  match(context: PatternContext) {
    const matches: ReturnType<PatternMatcher['match']> = [];
    const clueText = context.clueText;

    // Pattern: Letters N-M here/of this answer + letters X-Y of N-Across/Down
    const regex =
      /\(?(?:[Nn]ote\s+)?[Ll]etters?\s+(\d+)\s*[-–]\s*(\d+)\s+(?:here|of\s+this\s+answer)\s*\+\s*letters?\s+(\d+)\s*[-–]\s*(\d+)\s+of\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\)?/gi;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(clueText)) !== null) {
      const references: ClueReference[] = [];

      // Self-reference letters
      const selfStart = parseInt(match[1], 10);
      const selfEnd = parseInt(match[2], 10);
      references.push(
        createReference(
          context.currentClueNumber,
          context.currentDirection,
          match.index,
          match.index + match[0].length,
          { start: Math.min(selfStart, selfEnd), end: Math.max(selfStart, selfEnd) }
        )
      );

      // Cross-clue reference letters
      const crossStart = parseInt(match[3], 10);
      const crossEnd = parseInt(match[4], 10);
      const crossClueNumber = parseInt(match[5], 10);
      const crossDirection = normalizeDirection(match[6]);
      references.push(
        createReference(
          crossClueNumber,
          crossDirection,
          match.index,
          match.index + match[0].length,
          { start: Math.min(crossStart, crossEnd), end: Math.max(crossStart, crossEnd) }
        )
      );

      matches.push({
        matchedText: match[0],
        textStart: match.index,
        textEnd: match.index + match[0].length,
        references,
        highlightType: 'letter-range',
        patternId: 'cross-clue-letters',
      });
    }

    return matches;
  },
};

/**
 * Generic "letters X-Y of N-Across" reference (without "here" component)
 * Matches: "letters 6-7 of 21-Across", "letter 3 of 14-Down"
 */
export const externalLetterReferencePattern: PatternMatcher = createPatternMatcher({
  id: 'external-letter-reference',
  description: 'Letter reference to another clue (letters N-M of N-Across)',
  category: 'letter-reference',
  highlightType: 'letter-range',
  priority: 20,
  regex: /letters?\s+(\d+)(?:\s*[-–]\s*(\d+))?\s+(?:of\s+)?(\d+)\s*[-–]?\s*(Across|Down|A|D)/gi,
  extractReferences: (match) => {
    const startLetter = parseInt(match[1], 10);
    const endLetter = match[2] ? parseInt(match[2], 10) : startLetter;
    const clueNumber = parseInt(match[3], 10);
    const direction = normalizeDirection(match[4]);

    return [
      createReference(
        clueNumber,
        direction,
        match.index,
        match.index + match[0].length,
        { start: Math.min(startLetter, endLetter), end: Math.max(startLetter, endLetter) }
      ),
    ];
  },
});

/**
 * "last letter" reference within current answer
 * Matches: "(... last letter)", "note the last letter"
 */
export const lastLetterPattern: PatternMatcher = createPatternMatcher({
  id: 'last-letter',
  description: 'Reference to last letter of current answer',
  category: 'letter-reference',
  highlightType: 'letter-range',
  priority: 15,
  // Note: We can't know the actual last position without the answer length
  // We'll use -1 as a sentinel value and resolve it during cell resolution
  regex: /(?:\.\.\.|…)?\s*\(?(?:[Nn]ote\s+)?(?:the\s+)?last\s+letter(?:\s+here)?\)?/gi,
  extractReferences: (match, context) => {
    return [
      createReference(
        context.currentClueNumber,
        context.currentDirection,
        match.index,
        match.index + match[0].length,
        { start: -1, end: -1 } // Sentinel for "last letter"
      ),
    ];
  },
});

/**
 * All letter reference patterns in priority order.
 */
export const letterReferencePatterns: PatternMatcher[] = [
  crossClueLettersPattern,
  selfLetterRangePattern,
  selfLetterSinglePattern,
  externalLetterReferencePattern,
  lastLetterPattern,
];
