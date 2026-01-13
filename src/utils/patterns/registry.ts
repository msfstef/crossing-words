/**
 * Pattern Registry - Central coordination for pattern matching
 *
 * The registry manages all pattern matchers and provides a unified API
 * for parsing clue text. It handles:
 * - Pattern registration and deduplication
 * - Priority-based matching
 * - Overlap detection and resolution
 * - Configuration and filtering
 */

import type {
  PatternMatcher,
  PatternMatch,
  PatternContext,
  PatternRegistryConfig,
  ExtendedParsedReferences,
  ClueReference,
} from '../../types/clueReference';

import { directReferencePatterns } from './matchers/directReference';
import { letterReferencePatterns } from './matchers/letterReference';
import { themeMarkerPatterns } from './matchers/themeMarker';
import { answerSpanningPatterns } from './matchers/answerSpanning';
import { contextualPatterns } from './matchers/contextual';

/**
 * The Pattern Registry manages pattern matchers and coordinates parsing.
 */
export class PatternRegistry {
  private patterns: Map<string, PatternMatcher> = new Map();
  private config: PatternRegistryConfig;

  constructor(config: PatternRegistryConfig = {}) {
    this.config = config;
  }

  /**
   * Register a pattern matcher.
   * If a pattern with the same ID exists, it will be replaced.
   */
  register(pattern: PatternMatcher): void {
    if (this.config.excludePatterns?.includes(pattern.id)) {
      return;
    }
    if (
      this.config.includeOnlyPatterns &&
      !this.config.includeOnlyPatterns.includes(pattern.id)
    ) {
      return;
    }
    this.patterns.set(pattern.id, pattern);
  }

  /**
   * Register multiple patterns at once.
   */
  registerAll(patterns: PatternMatcher[]): void {
    for (const pattern of patterns) {
      this.register(pattern);
    }
  }

  /**
   * Unregister a pattern by ID.
   */
  unregister(patternId: string): boolean {
    return this.patterns.delete(patternId);
  }

  /**
   * Get a pattern by ID.
   */
  getPattern(patternId: string): PatternMatcher | undefined {
    return this.patterns.get(patternId);
  }

  /**
   * Get all registered patterns.
   */
  getAllPatterns(): PatternMatcher[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get patterns sorted by priority (highest first).
   */
  getPatternsByPriority(): PatternMatcher[] {
    return this.getAllPatterns().sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    );
  }

  /**
   * Parse clue text using all registered patterns.
   * Returns extended results with full match metadata.
   */
  parse(context: PatternContext): ExtendedParsedReferences {
    const allMatches: PatternMatch[] = [];
    const matchedPatternIds: string[] = [];

    // Track text ranges that have been matched to avoid overlaps
    const capturedRanges: Array<{ start: number; end: number }> = [];

    // Helper to check if a position overlaps with captured ranges
    const isOverlapping = (start: number, end: number): boolean => {
      return capturedRanges.some(
        (range) =>
          (start >= range.start && start < range.end) ||
          (end > range.start && end <= range.end) ||
          (start <= range.start && end >= range.end)
      );
    };

    // Process patterns in priority order
    const sortedPatterns = this.getPatternsByPriority();

    for (const pattern of sortedPatterns) {
      const matches = pattern.match(context);

      for (const match of matches) {
        // Skip if this range overlaps with already captured ranges
        if (isOverlapping(match.textStart, match.textEnd)) {
          continue;
        }

        allMatches.push(match);
        capturedRanges.push({
          start: match.textStart,
          end: match.textEnd,
        });

        if (!matchedPatternIds.includes(pattern.id)) {
          matchedPatternIds.push(pattern.id);
        }
      }
    }

    // Extract all references and compute flags
    const references: ClueReference[] = [];
    let hasLetterReferences = false;
    let hasStarredMarker = false;
    let hasThemeHint = false;
    let hasAnswerSpanning = false;

    for (const match of allMatches) {
      references.push(...match.references);

      if (match.highlightType === 'letter-range') {
        hasLetterReferences = true;
      }
      if (match.highlightType === 'starred') {
        hasStarredMarker = true;
      }
      if (match.highlightType === 'theme-hint') {
        hasThemeHint = true;
      }
      if (match.highlightType === 'answer-span') {
        hasAnswerSpanning = true;
        hasLetterReferences = true; // Answer-span also counts as letter reference
      }
    }

    // Also check if any reference has letterRange
    for (const ref of references) {
      if (ref.letterRange) {
        hasLetterReferences = true;
        break;
      }
    }

    if (this.config.debug) {
      console.log(`[PatternRegistry] Parsed clue: "${context.clueText}"`);
      console.log(`[PatternRegistry] Found ${allMatches.length} matches from ${matchedPatternIds.length} patterns`);
      console.log(`[PatternRegistry] Matched patterns: ${matchedPatternIds.join(', ')}`);
    }

    return {
      references,
      hasLetterReferences,
      matches: allMatches,
      matchedPatternIds,
      hasStarredMarker,
      hasThemeHint,
      hasAnswerSpanning,
    };
  }

  /**
   * Get statistics about the registry.
   */
  getStats(): {
    totalPatterns: number;
    patternsByCategory: Record<string, number>;
    patternsByHighlightType: Record<string, number>;
  } {
    const patterns = this.getAllPatterns();
    const patternsByCategory: Record<string, number> = {};
    const patternsByHighlightType: Record<string, number> = {};

    for (const pattern of patterns) {
      patternsByCategory[pattern.category] =
        (patternsByCategory[pattern.category] ?? 0) + 1;
      patternsByHighlightType[pattern.highlightType] =
        (patternsByHighlightType[pattern.highlightType] ?? 0) + 1;
    }

    return {
      totalPatterns: patterns.length,
      patternsByCategory,
      patternsByHighlightType,
    };
  }
}

/**
 * Create a registry with all default patterns registered.
 */
export function createDefaultRegistry(
  config: PatternRegistryConfig = {}
): PatternRegistry {
  const registry = new PatternRegistry(config);

  // Register all pattern categories
  // Note: Order matters for priority - higher priority patterns should be registered first
  // but actual matching order is determined by pattern.priority
  registry.registerAll(themeMarkerPatterns);
  registry.registerAll(letterReferencePatterns);
  registry.registerAll(answerSpanningPatterns);
  registry.registerAll(contextualPatterns);
  registry.registerAll(directReferencePatterns);

  return registry;
}

// Export a singleton default registry for convenience
let defaultRegistry: PatternRegistry | null = null;

/**
 * Get the default singleton registry.
 * Creates one if it doesn't exist.
 */
export function getDefaultRegistry(): PatternRegistry {
  if (!defaultRegistry) {
    defaultRegistry = createDefaultRegistry();
  }
  return defaultRegistry;
}

/**
 * Reset the default singleton registry.
 * Useful for testing or reconfiguration.
 */
export function resetDefaultRegistry(): void {
  defaultRegistry = null;
}
