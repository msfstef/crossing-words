/**
 * Types for clue reference parsing and highlighting
 */

/**
 * Represents a reference to another clue found within clue text.
 */
export interface ClueReference {
  /** The clue number being referenced (e.g., 17 in "17-Across") */
  clueNumber: number;
  /** The direction of the referenced clue */
  direction: 'across' | 'down';
  /** Start index in the original clue text where reference was found */
  textStart: number;
  /** End index in the original clue text where reference ends */
  textEnd: number;
  /** Optional: specific letter positions within the referenced clue (1-indexed) */
  letterRange?: {
    start: number;
    end: number;
  };
}

/**
 * Result of parsing a clue's text for references.
 */
export interface ParsedClueReferences {
  /** All clue references found in the text */
  references: ClueReference[];
  /** Whether this clue references specific letters (not just whole clues) */
  hasLetterReferences: boolean;
}

/**
 * Cells to highlight based on clue references.
 * Separates full-clue highlights from specific letter highlights.
 */
export interface ReferenceHighlights {
  /** Cells from fully-referenced clues (whole word highlight) - "row,col" format */
  referencedClueCells: Set<string>;
  /** Specific cells from letter-range references (individual cell highlight) - "row,col" format */
  letterReferenceCells: Set<string>;
}

// ============================================================================
// Pattern Registry Types (Extensible Meta-Clue Reference System)
// ============================================================================

/**
 * Highlight type indicating how a reference should be displayed.
 */
export type ReferenceHighlightType =
  | 'whole-clue'    // Highlight the entire referenced clue
  | 'letter-range'  // Highlight specific letter positions
  | 'starred'       // Mark as a starred/themed clue
  | 'theme-hint'    // Reference to multiple theme answers
  | 'answer-span';  // Letter combinations spanning consecutive answers

/**
 * Pattern category for organizational purposes.
 */
export type PatternCategory =
  | 'direct-reference'   // "See N-Across", "With N-Down"
  | 'letter-reference'   // Letter positions within answers
  | 'theme-marker'       // Starred clues, theme hints
  | 'answer-spanning'    // Letters spanning multiple answers
  | 'contextual';        // Contextual references (sounds like, part of)

/**
 * Match result from a pattern matcher.
 */
export interface PatternMatch {
  /** The full matched text */
  matchedText: string;
  /** Start position in original text */
  textStart: number;
  /** End position in original text */
  textEnd: number;
  /** Parsed clue references from this match */
  references: ClueReference[];
  /** What type of highlight to apply */
  highlightType: ReferenceHighlightType;
  /** Pattern ID that matched (for debugging/analytics) */
  patternId: string;
}

/**
 * Context passed to pattern matchers for reference resolution.
 */
export interface PatternContext {
  /** The clue text being parsed */
  clueText: string;
  /** The current clue's number */
  currentClueNumber: number;
  /** The current clue's direction */
  currentDirection: 'across' | 'down';
}

/**
 * A pattern matcher that can identify meta-clue references.
 * Implement this interface to add new reference patterns.
 */
export interface PatternMatcher {
  /** Unique identifier for this pattern */
  id: string;
  /** Human-readable description */
  description: string;
  /** Category for organizational purposes */
  category: PatternCategory;
  /** Default highlight type for matches */
  highlightType: ReferenceHighlightType;
  /** Priority (higher = matched first). Default is 0. */
  priority?: number;
  /**
   * Find all matches of this pattern in the given context.
   * @param context - The parsing context with clue text and metadata
   * @returns Array of matches found
   */
  match(context: PatternContext): PatternMatch[];
}

/**
 * Configuration for the pattern registry.
 */
export interface PatternRegistryConfig {
  /** Whether to enable debug logging */
  debug?: boolean;
  /** Patterns to exclude by ID */
  excludePatterns?: string[];
  /** If set, only these patterns will be used */
  includeOnlyPatterns?: string[];
}

/**
 * Extended parsed result including pattern metadata.
 */
export interface ExtendedParsedReferences extends ParsedClueReferences {
  /** All pattern matches with full metadata */
  matches: PatternMatch[];
  /** IDs of patterns that matched */
  matchedPatternIds: string[];
  /** Whether any starred clue markers were found */
  hasStarredMarker: boolean;
  /** Whether any theme hints were found */
  hasThemeHint: boolean;
  /** Whether any answer-spanning references were found */
  hasAnswerSpanning: boolean;
}

// ============================================================================
// Pre-computed Clue Reference Types (for O(1) lookup on clue change)
// ============================================================================

/**
 * Pre-computed reference data for a single clue.
 * Stored in a map for O(1) lookup when navigating between clues.
 */
export interface PrecomputedClueReference {
  /** Cells from fully-referenced clues (whole word highlight) - "row,col" format */
  referencedClueCells: Set<string>;
  /** Specific cells from letter-range references - "row,col" format */
  letterReferenceCells: Set<string>;
  /** Cells from the meta clue that references this clue's starred group - "row,col" format */
  metaClueCells: Set<string>;
  /** Whether this clue has any references */
  hasReferences: boolean;
  /** Whether this clue has letter-specific references */
  hasLetterReferences: boolean;
  /** Whether this clue has a meta clue that describes it */
  hasMetaClue: boolean;
}

/**
 * Map from clue ID (e.g., "17-across") to pre-computed references.
 * Pre-computed at puzzle load time for instant lookup on clue change.
 */
export type ClueReferenceMap = Map<string, PrecomputedClueReference>;
