/**
 * Comprehensive tests for clue reference parsing and highlighting
 *
 * These tests cover all pattern types:
 * - Direct references (See, With, possessive, multi-clue)
 * - Starred clue patterns (detection and resolution)
 * - Letter reference patterns
 * - Theme marker patterns (circled letters, theme hints)
 * - Integration tests for buildClueReferenceMap
 */

import { describe, it, expect } from 'vitest';
import {
  parseClueReferences,
  parseClueReferencesExtended,
  buildClueReferenceMap,
  isStarredClue,
  getClueDisplayText,
} from '../../utils/clueReferenceParser';
import type { Puzzle, Clue } from '../../types/puzzle';

// Helper to create a minimal test puzzle
function createTestPuzzle(clues: { across: Clue[]; down: Clue[] }): Puzzle {
  const width = 5;
  const height = 5;
  const grid = Array(height)
    .fill(null)
    .map((_, row) =>
      Array(width)
        .fill(null)
        .map((_, col) => ({
          row,
          col,
          letter: 'A',
          isBlack: false,
          clueNumber: row === 0 && col === 0 ? 1 : undefined,
        }))
    );

  return {
    title: 'Test Puzzle',
    grid,
    clues,
    width,
    height,
  };
}

// Helper to create a clue
function createClue(
  number: number,
  direction: 'across' | 'down',
  text: string,
  row = 0,
  col = 0,
  length = 5
): Clue {
  return { number, direction, text, row, col, length };
}

describe('Direct Reference Patterns', () => {
  describe('See Reference', () => {
    it('should parse "See N-Across" pattern', () => {
      const result = parseClueReferences('See 17-Across', 1, 'down');
      expect(result.references).toHaveLength(1);
      expect(result.references[0]).toEqual(
        expect.objectContaining({
          clueNumber: 17,
          direction: 'across',
        })
      );
    });

    it('should parse "See N-Down" pattern', () => {
      const result = parseClueReferences('See 21-Down', 1, 'across');
      expect(result.references).toHaveLength(1);
      expect(result.references[0]).toEqual(
        expect.objectContaining({
          clueNumber: 21,
          direction: 'down',
        })
      );
    });

    it('should parse abbreviated "See 17A" pattern', () => {
      const result = parseClueReferences('See 17A', 1, 'down');
      expect(result.references).toHaveLength(1);
      expect(result.references[0]).toEqual(
        expect.objectContaining({
          clueNumber: 17,
          direction: 'across',
        })
      );
    });

    it('should parse "See N Across" with space', () => {
      const result = parseClueReferences('See 54 Across', 1, 'down');
      expect(result.references).toHaveLength(1);
      expect(result.references[0].clueNumber).toBe(54);
    });
  });

  describe('With Reference', () => {
    it('should parse "With N-Across," pattern', () => {
      const result = parseClueReferences(
        'With 29-Down, piece such as Beethoven\'s "Tempest"',
        38,
        'across'
      );
      expect(result.references).toHaveLength(1);
      expect(result.references[0]).toEqual(
        expect.objectContaining({
          clueNumber: 29,
          direction: 'down',
        })
      );
    });

    it('should parse "With N-Down," pattern', () => {
      const result = parseClueReferences(
        'With 9-Down, power whose source goes down regularly',
        4,
        'down'
      );
      expect(result.references).toHaveLength(1);
      expect(result.references[0].clueNumber).toBe(9);
    });
  });

  describe('Possessive Reference', () => {
    it('should parse "N-Down\'s" pattern', () => {
      const result = parseClueReferences("20-Down's prov.", 46, 'down');
      expect(result.references).toHaveLength(1);
      expect(result.references[0]).toEqual(
        expect.objectContaining({
          clueNumber: 20,
          direction: 'down',
        })
      );
    });

    it('should parse "N-Across\'s" pattern', () => {
      const result = parseClueReferences("17-Across's answer", 1, 'down');
      expect(result.references).toHaveLength(1);
      expect(result.references[0].clueNumber).toBe(17);
      expect(result.references[0].direction).toBe('across');
    });
  });

  describe('Multi-Clue Reference', () => {
    it('should parse "N-, M-, and K-Across" pattern', () => {
      const result = parseClueReferences(
        'Complete success, and a hint to 20-, 31- and 47-Across?',
        55,
        'across'
      );
      expect(result.references).toHaveLength(3);
      expect(result.references.map((r) => r.clueNumber)).toEqual([20, 31, 47]);
      expect(result.references.every((r) => r.direction === 'across')).toBe(true);
    });

    it('should parse four-clue reference', () => {
      const result = parseClueReferences(
        'A hint to 17-, 23-, 39- and 53-Across',
        62,
        'across'
      );
      expect(result.references).toHaveLength(4);
      expect(result.references.map((r) => r.clueNumber)).toEqual([17, 23, 39, 53]);
    });

    it('should parse multi-clue with "or" connector', () => {
      const result = parseClueReferences(
        'Narrated by the protagonist, or a hint to the start of 18-, 24-, 41- or 51-Across',
        62,
        'across'
      );
      expect(result.references).toHaveLength(4);
      expect(result.references.map((r) => r.clueNumber)).toEqual([18, 24, 41, 51]);
    });

    it('should parse three-clue reference with "or"', () => {
      const result = parseClueReferences(
        'Ozzy Osbourne song, or what you might take in 20-, 28- or 45-Across',
        1,
        'across'
      );
      expect(result.references).toHaveLength(3);
      expect(result.references.map((r) => r.clueNumber)).toEqual([20, 28, 45]);
    });

    it('should parse multi-clue Down reference', () => {
      const result = parseClueReferences(
        'Start of a popular aphorism that\'s a hint to 5-, 7- and 32-Down',
        34,
        'down'
      );
      expect(result.references).toHaveLength(3);
      expect(result.references.every((r) => r.direction === 'down')).toBe(true);
    });
  });

  describe('Inline Reference', () => {
    it('should parse simple "N-Across" inline', () => {
      const result = parseClueReferences('Feature of a 41-Down', 42, 'down');
      expect(result.references).toHaveLength(1);
      expect(result.references[0].clueNumber).toBe(41);
    });

    it('should parse "Like N-Across" pattern', () => {
      const result = parseClueReferences('Like 14-Across', 43, 'across');
      expect(result.references).toHaveLength(1);
      expect(result.references[0].clueNumber).toBe(14);
    });
  });
});

describe('Starred Clue Patterns', () => {
  describe('Starred Clue Detection', () => {
    it('should detect clues starting with *', () => {
      expect(isStarredClue('*First stage in a video game')).toBe(true);
      expect(isStarredClue('*Puffs up')).toBe(true);
    });

    it('should not detect non-starred clues', () => {
      expect(isStarredClue('First stage in a video game')).toBe(false);
      expect(isStarredClue('Complete success')).toBe(false);
    });

    it('should strip starred marker for display', () => {
      expect(getClueDisplayText('*First stage in a video game')).toBe(
        'First stage in a video game'
      );
      expect(getClueDisplayText('Regular clue')).toBe('Regular clue');
    });
  });

  describe('Starred Reference Detection', () => {
    it('should detect "starred clues\' answers" reference', () => {
      const result = parseClueReferencesExtended(
        'To the max ... or, read differently, a hint to the starred clues\' answers?',
        59,
        'across'
      );
      expect(result.hasStarredMarker).toBe(true);
    });

    it('should detect "starred answers" reference', () => {
      const result = parseClueReferencesExtended(
        'Finishes dramatically, and what each of the starred answers does',
        37,
        'across'
      );
      expect(result.hasStarredMarker).toBe(true);
    });

    it('should detect "each starred answer" reference', () => {
      const result = parseClueReferencesExtended(
        '"To be on the safe side," like each starred answer',
        60,
        'across'
      );
      expect(result.hasStarredMarker).toBe(true);
    });

    it('should detect "starred entries" reference', () => {
      const result = parseClueReferencesExtended(
        'A description of the starred entries',
        1,
        'across'
      );
      expect(result.hasStarredMarker).toBe(true);
    });

    it('should detect "hint to the starred clues" reference', () => {
      const result = parseClueReferencesExtended(
        'A hint to the starred clues',
        1,
        'across'
      );
      expect(result.hasStarredMarker).toBe(true);
    });

    it('should not detect starred reference in unrelated clues', () => {
      const result = parseClueReferencesExtended('Ocean liner', 1, 'across');
      expect(result.hasStarredMarker).toBe(false);
    });
  });

  describe('Starred Clue Resolution', () => {
    it('should resolve starred clue cells when reference is detected', () => {
      const puzzle = createTestPuzzle({
        across: [
          createClue(1, 'across', '*Starred clue one', 0, 0, 5),
          createClue(6, 'across', '*Starred clue two', 1, 0, 5),
          createClue(
            11,
            'across',
            'A hint to the starred clues\' answers',
            2,
            0,
            5
          ),
        ],
        down: [],
      });

      const map = buildClueReferenceMap(puzzle);
      const revealerData = map.get('11-across');

      expect(revealerData).toBeDefined();
      expect(revealerData!.hasReferences).toBe(true);
      // Should have cells from both starred clues (10 cells total: 5 + 5)
      expect(revealerData!.referencedClueCells.size).toBe(10);
    });

    it('should not highlight starred clues when no starred reference', () => {
      const puzzle = createTestPuzzle({
        across: [
          createClue(1, 'across', '*Starred clue one', 0, 0, 5),
          createClue(6, 'across', 'Regular clue', 1, 0, 5),
        ],
        down: [],
      });

      const map = buildClueReferenceMap(puzzle);
      const regularData = map.get('6-across');

      expect(regularData).toBeDefined();
      expect(regularData!.hasReferences).toBe(false);
      expect(regularData!.referencedClueCells.size).toBe(0);
    });
  });

  describe('Meta Clue Reverse Lookup', () => {
    it('should provide meta clue cells when focusing on a starred clue', () => {
      const puzzle = createTestPuzzle({
        across: [
          createClue(1, 'across', '*Starred clue one', 0, 0, 5),
          createClue(6, 'across', '*Starred clue two', 1, 0, 5),
          createClue(
            11,
            'across',
            'A hint to the starred clues\' answers',
            2,
            0,
            5
          ),
        ],
        down: [],
      });

      const map = buildClueReferenceMap(puzzle);

      // When focusing on starred clue 1, should have meta clue cells
      const starredClue1Data = map.get('1-across');
      expect(starredClue1Data).toBeDefined();
      expect(starredClue1Data!.hasMetaClue).toBe(true);
      // Should have cells from the revealer clue (5 cells on row 2)
      expect(starredClue1Data!.metaClueCells.size).toBe(5);
      expect(starredClue1Data!.metaClueCells.has('2,0')).toBe(true);
      expect(starredClue1Data!.metaClueCells.has('2,4')).toBe(true);

      // When focusing on starred clue 2, should also have meta clue cells
      const starredClue2Data = map.get('6-across');
      expect(starredClue2Data).toBeDefined();
      expect(starredClue2Data!.hasMetaClue).toBe(true);
      expect(starredClue2Data!.metaClueCells.size).toBe(5);
    });

    it('should not provide meta clue cells for non-starred clues', () => {
      const puzzle = createTestPuzzle({
        across: [
          createClue(1, 'across', '*Starred clue one', 0, 0, 5),
          createClue(6, 'across', 'Regular clue', 1, 0, 5),
          createClue(
            11,
            'across',
            'A hint to the starred clues\' answers',
            2,
            0,
            5
          ),
        ],
        down: [],
      });

      const map = buildClueReferenceMap(puzzle);

      // Regular clue should not have meta clue cells
      const regularClueData = map.get('6-across');
      expect(regularClueData).toBeDefined();
      expect(regularClueData!.hasMetaClue).toBe(false);
      expect(regularClueData!.metaClueCells.size).toBe(0);
    });

    it('should not provide meta clue cells when no revealer exists', () => {
      const puzzle = createTestPuzzle({
        across: [
          createClue(1, 'across', '*Starred clue one', 0, 0, 5),
          createClue(6, 'across', '*Starred clue two', 1, 0, 5),
          createClue(11, 'across', 'Regular clue with no starred reference', 2, 0, 5),
        ],
        down: [],
      });

      const map = buildClueReferenceMap(puzzle);

      // Starred clues should not have meta clue cells when no revealer exists
      const starredClueData = map.get('1-across');
      expect(starredClueData).toBeDefined();
      expect(starredClueData!.hasMetaClue).toBe(false);
      expect(starredClueData!.metaClueCells.size).toBe(0);
    });

    it('should handle multiple meta clues referencing starred clues', () => {
      const puzzle = createTestPuzzle({
        across: [
          createClue(1, 'across', '*Starred clue one', 0, 0, 5),
          createClue(6, 'across', 'First hint to the starred answers', 1, 0, 5),
          createClue(11, 'across', 'Second hint to the starred clues', 2, 0, 5),
        ],
        down: [],
      });

      const map = buildClueReferenceMap(puzzle);

      // Starred clue should have cells from both meta clues
      const starredClueData = map.get('1-across');
      expect(starredClueData).toBeDefined();
      expect(starredClueData!.hasMetaClue).toBe(true);
      // Should have cells from both revealers (5 + 5 = 10)
      expect(starredClueData!.metaClueCells.size).toBe(10);
    });

    it('should not include self-reference in meta clue cells', () => {
      // Edge case: a clue that is both starred AND references starred clues
      const puzzle = createTestPuzzle({
        across: [
          createClue(1, 'across', '*Starred clue, also a hint to the starred answers', 0, 0, 5),
          createClue(6, 'across', '*Another starred clue', 1, 0, 5),
        ],
        down: [],
      });

      const map = buildClueReferenceMap(puzzle);

      // Clue 1 is both starred and references starred clues
      // Its metaClueCells should not include its own cells
      const clue1Data = map.get('1-across');
      expect(clue1Data).toBeDefined();
      // Should not include self in metaClueCells
      expect(clue1Data!.metaClueCells.has('0,0')).toBe(false);
      expect(clue1Data!.metaClueCells.has('0,1')).toBe(false);

      // Clue 6 should have clue 1 in its metaClueCells (since clue 1 references starred clues)
      const clue6Data = map.get('6-across');
      expect(clue6Data).toBeDefined();
      expect(clue6Data!.hasMetaClue).toBe(true);
      expect(clue6Data!.metaClueCells.has('0,0')).toBe(true);
    });
  });
});

describe('Letter Reference Patterns', () => {
  it('should detect letter-single pattern', () => {
    const result = parseClueReferences(
      'In this answer, note the 6th letter',
      16,
      'across'
    );
    expect(result.hasLetterReferences).toBe(true);
  });

  it('should detect letter-range pattern', () => {
    const result = parseClueReferences(
      'Film franchise that parodies the horror genre (In this answer, unscramble letters 3-6)',
      17,
      'across'
    );
    expect(result.hasLetterReferences).toBe(true);
  });

  it('should detect last letter pattern', () => {
    const result = parseClueReferences(
      'Secret agent\'s file (... last letter)',
      61,
      'across'
    );
    expect(result.hasLetterReferences).toBe(true);
  });

  it('should detect cross-clue letter reference', () => {
    const result = parseClueReferences(
      'Letters 6-7 here + letters 2-1 of 21-Across',
      16,
      'across'
    );
    expect(result.hasLetterReferences).toBe(true);
    expect(result.references.some((r) => r.clueNumber === 21)).toBe(true);
  });
});

describe('Theme Marker Patterns', () => {
  describe('Theme Hint Multi', () => {
    it('should parse theme hint with multiple clue references', () => {
      const result = parseClueReferences(
        'A hint to 17-, 23-, 39- and 53-Across',
        62,
        'across'
      );
      expect(result.references).toHaveLength(4);
    });

    it('should parse hint with "ends of" modifier', () => {
      const result = parseClueReferences(
        'A hint to the ends of 17-, 26-, 40- and 50-Across',
        61,
        'across'
      );
      expect(result.references).toHaveLength(4);
    });
  });

  describe('Theme Hint Marker', () => {
    it('should detect "and a theme hint" pattern', () => {
      const result = parseClueReferencesExtended(
        'Urban unit, or a theme hint',
        38,
        'across'
      );
      expect(result.hasThemeHint).toBe(true);
    });
  });

  describe('Circled Letters', () => {
    it('should detect "circled letters" pattern', () => {
      const result = parseClueReferencesExtended(
        'Do a Christmas activity, or a hint to each set of circled letters',
        114,
        'across'
      );
      expect(result.hasThemeHint).toBe(true);
    });

    it('should detect "the circled letters" pattern', () => {
      const result = parseClueReferencesExtended(
        '1967 Turtles hit, or a hint to the circled letters',
        123,
        'across'
      );
      expect(result.hasThemeHint).toBe(true);
    });
  });

  describe('Shaded Letters', () => {
    it('should detect "shaded letters" pattern', () => {
      const result = parseClueReferencesExtended(
        'Note the shaded letters in this grid',
        1,
        'across'
      );
      expect(result.hasThemeHint).toBe(true);
    });

    it('should detect "highlighted squares" pattern', () => {
      const result = parseClueReferencesExtended(
        'The highlighted squares spell out a message',
        1,
        'across'
      );
      expect(result.hasThemeHint).toBe(true);
    });
  });
});

describe('Contextual Reference Patterns', () => {
  it('should parse "sounds like N-Across" pattern', () => {
    const result = parseClueReferences('Lake that sounds like 16-Across', 2, 'down');
    expect(result.references).toHaveLength(1);
    expect(result.references[0].clueNumber).toBe(16);
  });

  it('should parse "after saying N-Across" pattern', () => {
    const result = parseClueReferences(
      "Bride's title, after saying 33-Across",
      22,
      'across'
    );
    expect(result.references).toHaveLength(1);
    expect(result.references[0].clueNumber).toBe(33);
  });
});

describe('buildClueReferenceMap Integration', () => {
  it('should build complete reference map for puzzle', () => {
    const puzzle = createTestPuzzle({
      across: [
        createClue(1, 'across', 'See 6-Across', 0, 0, 5),
        createClue(6, 'across', 'Regular clue', 1, 0, 5),
      ],
      down: [createClue(1, 'down', 'Another clue', 0, 0, 5)],
    });

    const map = buildClueReferenceMap(puzzle);

    expect(map.size).toBe(3); // 2 across + 1 down
    expect(map.get('1-across')!.hasReferences).toBe(true);
    expect(map.get('6-across')!.hasReferences).toBe(false);
    expect(map.get('1-down')!.hasReferences).toBe(false);
  });

  it('should resolve cell coordinates correctly', () => {
    const puzzle = createTestPuzzle({
      across: [
        createClue(1, 'across', 'See 6-Across', 0, 0, 5),
        createClue(6, 'across', 'Target clue', 1, 0, 5),
      ],
      down: [],
    });

    const map = buildClueReferenceMap(puzzle);
    const data = map.get('1-across');

    expect(data!.referencedClueCells.size).toBe(5);
    // Clue 6 is on row 1, cols 0-4
    expect(data!.referencedClueCells.has('1,0')).toBe(true);
    expect(data!.referencedClueCells.has('1,1')).toBe(true);
    expect(data!.referencedClueCells.has('1,2')).toBe(true);
    expect(data!.referencedClueCells.has('1,3')).toBe(true);
    expect(data!.referencedClueCells.has('1,4')).toBe(true);
  });
});

describe('Real-World Clue Examples', () => {
  // Test actual clues from the puzzle analysis
  describe('Universal Crossword Examples', () => {
    it('should parse complete theme revealer', () => {
      const result = parseClueReferencesExtended(
        'To the max ... or, read differently, a hint to the starred clues\' answers?',
        59,
        'across'
      );
      expect(result.hasStarredMarker).toBe(true);
    });

    it('should parse theme with specific clue numbers', () => {
      const result = parseClueReferences(
        'Reaching a point of decline, in TV lingo ... or the key to interpreting 17-, 25-, 51- and 53-Across',
        38,
        'across'
      );
      expect(result.references).toHaveLength(4);
      expect(result.references.map((r) => r.clueNumber)).toEqual([17, 25, 51, 53]);
    });

    it('should parse "first person" theme revealer', () => {
      const result = parseClueReferences(
        'Narrated by the protagonist, or a hint to the start of 18-, 24-, 41- or 51-Across',
        62,
        'across'
      );
      // "18-, 24-, 41- or 51-Across" uses "or" instead of "and",
      // but should still be captured by multi-clue pattern
      expect(result.references.length).toBeGreaterThan(0);
    });
  });

  describe('WSJ Examples', () => {
    it('should parse possessive in complex clue', () => {
      const result = parseClueReferences(
        "Touchdown follower [a hint to the circled part's place may be found in 110-Down's clue]",
        23,
        'across'
      );
      expect(result.references.some((r) => r.clueNumber === 110)).toBe(true);
    });
  });
});
