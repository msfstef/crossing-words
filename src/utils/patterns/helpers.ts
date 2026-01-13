/**
 * Helper utilities for pattern matching
 */

import type {
  ClueReference,
  PatternMatch,
  PatternMatcher,
  PatternContext,
  PatternCategory,
  ReferenceHighlightType,
} from '../../types/clueReference';

/**
 * Normalize direction indicator to standard format.
 * Handles: "Across", "Down", "A", "D", "across", "down", etc.
 */
export function normalizeDirection(indicator: string): 'across' | 'down' {
  const lower = indicator.toLowerCase().trim();
  if (lower === 'a' || lower === 'across') return 'across';
  if (lower === 'd' || lower === 'down') return 'down';
  return 'across'; // Default fallback
}

/**
 * Create a ClueReference from extracted values.
 */
export function createReference(
  clueNumber: number,
  direction: 'across' | 'down',
  textStart: number,
  textEnd: number,
  letterRange?: { start: number; end: number }
): ClueReference {
  return {
    clueNumber,
    direction,
    textStart,
    textEnd,
    ...(letterRange && { letterRange }),
  };
}

/**
 * Create a PatternMatch from matched values.
 */
export function createMatch(
  matchedText: string,
  textStart: number,
  textEnd: number,
  references: ClueReference[],
  highlightType: ReferenceHighlightType,
  patternId: string
): PatternMatch {
  return {
    matchedText,
    textStart,
    textEnd,
    references,
    highlightType,
    patternId,
  };
}

/**
 * Options for creating a regex-based pattern matcher.
 */
interface RegexMatcherOptions {
  id: string;
  description: string;
  category: PatternCategory;
  highlightType: ReferenceHighlightType;
  priority?: number;
  regex: RegExp;
  /**
   * Extract references from a regex match.
   * @param match - The regex match result
   * @param context - The parsing context
   * @returns Array of ClueReferences, or null to skip this match
   */
  extractReferences: (
    match: RegExpExecArray,
    context: PatternContext
  ) => ClueReference[] | null;
}

/**
 * Create a simple regex-based pattern matcher.
 * This is a convenience factory for patterns that can be expressed as a regex.
 */
export function createPatternMatcher(
  options: RegexMatcherOptions
): PatternMatcher {
  const {
    id,
    description,
    category,
    highlightType,
    priority = 0,
    regex,
    extractReferences,
  } = options;

  return {
    id,
    description,
    category,
    highlightType,
    priority,
    match(context: PatternContext): PatternMatch[] {
      const matches: PatternMatch[] = [];
      const clueText = context.clueText;

      // Create a new regex instance to avoid state issues
      const localRegex = new RegExp(regex.source, regex.flags);
      let regexMatch: RegExpExecArray | null;

      while ((regexMatch = localRegex.exec(clueText)) !== null) {
        const references = extractReferences(regexMatch, context);

        if (references && references.length > 0) {
          matches.push(
            createMatch(
              regexMatch[0],
              regexMatch.index,
              regexMatch.index + regexMatch[0].length,
              references,
              highlightType,
              id
            )
          );
        }
      }

      return matches;
    },
  };
}
