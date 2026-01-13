/**
 * Answer-Spanning Pattern Matchers
 *
 * These patterns identify clues that span letters across consecutive answers:
 * - "last 3 letters of this answer + ..."
 * - "... first 4 letters of this answer"
 *
 * These are typically used for themed puzzles where words span across
 * multiple grid entries.
 */

import type { PatternMatcher, PatternMatch, PatternContext, ClueReference } from '../../../types/clueReference';
import { createReference } from '../helpers';

/**
 * Answer-spanning: last N letters continuing to next clue
 * Matches: "(Note the last 3 letters of this answer + ...)"
 * Matches: "(Last 4 letters + ...)"
 */
export const answerSpanLastPattern: PatternMatcher = {
  id: 'answer-span-last',
  description: 'Answer-spanning reference (last N letters + ...)',
  category: 'answer-spanning',
  highlightType: 'answer-span',
  priority: 30, // Higher priority to match before self-letter patterns
  match(context: PatternContext): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const clueText = context.clueText;

    // Pattern: last N letters (of this answer)? + ...
    const regex =
      /\(?(?:[Nn]ote\s+)?(?:the\s+)?[Ll]ast\s+(\d+)\s+letters?\s*(?:of\s+this\s+answer)?\s*\+\s*(?:\.\.\.|…)\)?/gi;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(clueText)) !== null) {
      const letterCount = parseInt(match[1], 10);

      // Use negative numbers as sentinel for "last N letters"
      // -letterCount means "last letterCount letters"
      const references: ClueReference[] = [
        createReference(
          context.currentClueNumber,
          context.currentDirection,
          match.index,
          match.index + match[0].length,
          { start: -letterCount, end: -1 } // Sentinel: negative start means "from end"
        ),
      ];

      matches.push({
        matchedText: match[0],
        textStart: match.index,
        textEnd: match.index + match[0].length,
        references,
        highlightType: 'answer-span',
        patternId: 'answer-span-last',
      });
    }

    return matches;
  },
};

/**
 * Answer-spanning: first N letters continuing from previous clue
 * Matches: "(... the first 6 letters of this answer)"
 * Matches: "(... first 4 letters)"
 */
export const answerSpanFirstPattern: PatternMatcher = {
  id: 'answer-span-first',
  description: 'Answer-spanning continuation (... first N letters)',
  category: 'answer-spanning',
  highlightType: 'answer-span',
  priority: 30, // Higher priority to match before self-letter patterns
  match(context: PatternContext): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const clueText = context.clueText;

    // Pattern: ... first N letters (of this answer)?
    const regex =
      /\(?(?:\.\.\.|…)\s*(?:the\s+)?[Ff]irst\s+(\d+)\s+letters?\s*(?:of\s+this\s+answer)?\)?/gi;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(clueText)) !== null) {
      const letterCount = parseInt(match[1], 10);

      const references: ClueReference[] = [
        createReference(
          context.currentClueNumber,
          context.currentDirection,
          match.index,
          match.index + match[0].length,
          { start: 1, end: letterCount }
        ),
      ];

      matches.push({
        matchedText: match[0],
        textStart: match.index,
        textEnd: match.index + match[0].length,
        references,
        highlightType: 'answer-span',
        patternId: 'answer-span-first',
      });
    }

    return matches;
  },
};

/**
 * Answer-spanning: last N letters without explicit continuation marker
 * Matches: "(Note the last 3 letters of this answer + ...)" where "..." is implicit
 * This is a fallback for less structured references
 */
export const answerSpanLastSimplePattern: PatternMatcher = {
  id: 'answer-span-last-simple',
  description: 'Simple last N letters reference (may span answers)',
  category: 'answer-spanning',
  highlightType: 'answer-span',
  priority: 10,
  match(context: PatternContext): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const clueText = context.clueText;

    // Pattern: (last N letters ...) without explicit + ...
    // More permissive to catch variations
    const regex =
      /\(?[Ll]ast\s+(\d+)\s+letters?\s*(?:of\s+this\s+answer)?\s*(?:\+|\.\.\.|…)/gi;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(clueText)) !== null) {
      const letterCount = parseInt(match[1], 10);

      const references: ClueReference[] = [
        createReference(
          context.currentClueNumber,
          context.currentDirection,
          match.index,
          match.index + match[0].length,
          { start: -letterCount, end: -1 }
        ),
      ];

      matches.push({
        matchedText: match[0],
        textStart: match.index,
        textEnd: match.index + match[0].length,
        references,
        highlightType: 'answer-span',
        patternId: 'answer-span-last-simple',
      });
    }

    return matches;
  },
};

/**
 * All answer-spanning patterns in priority order.
 */
export const answerSpanningPatterns: PatternMatcher[] = [
  answerSpanLastPattern,
  answerSpanFirstPattern,
  answerSpanLastSimplePattern,
];
