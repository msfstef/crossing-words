/**
 * Contextual Reference Pattern Matchers
 *
 * These patterns match contextual references that use the meaning
 * or sound of another answer:
 * - "to a 22-Down" (where 22-Down's answer provides context)
 * - "sounds like 16-Across"
 * - "cast member of 23-Across"
 */

import type { PatternMatcher } from '../../../types/clueReference';
import { createPatternMatcher, normalizeDirection, createReference } from '../helpers';

/**
 * Contextual reference using answer meaning
 * Matches: "Life, to a 22-Down", "to an 18-Across"
 */
export const contextualReferencePattern: PatternMatcher = createPatternMatcher({
  id: 'contextual-reference',
  description: 'Contextual reference using answer meaning (to a N-Down)',
  category: 'contextual',
  highlightType: 'whole-clue',
  priority: 10,
  regex: /\bto\s+(?:a|an)\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi,
  extractReferences: (match) => {
    const clueNumber = parseInt(match[1], 10);
    const direction = normalizeDirection(match[2]);
    return [createReference(clueNumber, direction, match.index, match.index + match[0].length)];
  },
});

/**
 * Sound-alike reference
 * Matches: "sounds like 16-Across", "homophone of 23-Down"
 */
export const soundsLikePattern: PatternMatcher = createPatternMatcher({
  id: 'sounds-like',
  description: 'Sound-alike reference (sounds like N-Across)',
  category: 'contextual',
  highlightType: 'whole-clue',
  priority: 10,
  regex: /\b(?:sounds?\s+like|homophone\s+of|rhymes?\s+with)\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi,
  extractReferences: (match) => {
    const clueNumber = parseInt(match[1], 10);
    const direction = normalizeDirection(match[2]);
    return [createReference(clueNumber, direction, match.index, match.index + match[0].length)];
  },
});

/**
 * Part-of or member-of reference
 * Matches: "cast member of 23-Across", "part of 17-Down"
 */
export const partOfReferencePattern: PatternMatcher = createPatternMatcher({
  id: 'part-of-reference',
  description: 'Part-of or member-of reference (part of N-Across)',
  category: 'contextual',
  highlightType: 'whole-clue',
  priority: 10,
  regex:
    /\b(?:member|part|character|star|host|contestant|actor|actress|player|singer|element|component)\s+(?:of|in|on|from)\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi,
  extractReferences: (match) => {
    const clueNumber = parseInt(match[1], 10);
    const direction = normalizeDirection(match[2]);
    return [createReference(clueNumber, direction, match.index, match.index + match[0].length)];
  },
});

/**
 * "Like N-Across" comparison reference
 * Matches: "Like 17-Across", "unlike 23-Down"
 */
export const likeReferencePattern: PatternMatcher = createPatternMatcher({
  id: 'like-reference',
  description: '"Like N-Across" comparison reference',
  category: 'contextual',
  highlightType: 'whole-clue',
  priority: 10,
  regex: /\b(?:like|unlike|similar\s+to|opposite\s+of)\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi,
  extractReferences: (match) => {
    const clueNumber = parseInt(match[1], 10);
    const direction = normalizeDirection(match[2]);
    return [createReference(clueNumber, direction, match.index, match.index + match[0].length)];
  },
});

/**
 * "Partner of N-Across" reference
 * Matches: "Partner of 17-Across", "complement to 23-Down"
 */
export const partnerOfPattern: PatternMatcher = createPatternMatcher({
  id: 'partner-of',
  description: '"Partner of N-Across" reference',
  category: 'contextual',
  highlightType: 'whole-clue',
  priority: 10,
  regex:
    /\b(?:partner|complement|opposite|counterpart|companion|match)\s+(?:of|to)\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi,
  extractReferences: (match) => {
    const clueNumber = parseInt(match[1], 10);
    const direction = normalizeDirection(match[2]);
    return [createReference(clueNumber, direction, match.index, match.index + match[0].length)];
  },
});

/**
 * "Anagram of N-Across" reference
 * Matches: "Anagram of 17-Across"
 */
export const anagramOfPattern: PatternMatcher = createPatternMatcher({
  id: 'anagram-of',
  description: '"Anagram of N-Across" reference',
  category: 'contextual',
  highlightType: 'whole-clue',
  priority: 10,
  regex: /\b(?:anagram)\s+of\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi,
  extractReferences: (match) => {
    const clueNumber = parseInt(match[1], 10);
    const direction = normalizeDirection(match[2]);
    return [createReference(clueNumber, direction, match.index, match.index + match[0].length)];
  },
});

/**
 * All contextual reference patterns in priority order.
 */
export const contextualPatterns: PatternMatcher[] = [
  contextualReferencePattern,
  soundsLikePattern,
  partOfReferencePattern,
  likeReferencePattern,
  partnerOfPattern,
  anagramOfPattern,
];
