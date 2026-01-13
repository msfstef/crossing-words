/**
 * Extensible Pattern Registry for Meta-Clue Reference Parsing
 *
 * This subsystem provides a pluggable architecture for detecting and parsing
 * various types of clue references in crossword puzzles. New pattern types
 * can be added by implementing the PatternMatcher interface.
 *
 * Pattern Categories:
 * - direct-reference: "See N-Across", "With N-Down", "N-Across's"
 * - letter-reference: Letter positions within answers
 * - theme-marker: Starred clues, theme hints
 * - answer-spanning: Letters spanning consecutive answers
 * - contextual: Contextual references (sounds like, part of)
 */

export { PatternRegistry, createDefaultRegistry } from './registry';
export { createPatternMatcher, normalizeDirection } from './helpers';

// Export all individual pattern matchers for custom configurations
export * from './matchers/directReference';
export * from './matchers/letterReference';
export * from './matchers/themeMarker';
export * from './matchers/answerSpanning';
export * from './matchers/contextual';
