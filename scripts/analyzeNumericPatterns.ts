#!/usr/bin/env npx tsx

/**
 * Script to analyze numeric clue reference patterns in crossword puzzles.
 * Focuses on multi-clue references like "17-, 23-, and 48-Across"
 */

import { puzToXD, xdToJSON } from 'xd-crossword-tools';
import { execSync } from 'child_process';
import { readFileSync, unlinkSync, existsSync } from 'fs';

interface ClueInfo {
  source: string;
  date: string;
  puzzleTitle: string;
  number: number;
  direction: 'across' | 'down';
  text: string;
  answer?: string;
}

// Puzzle sources with their URL patterns
const SOURCES = {
  universal: (date: Date) => {
    const dateStr = formatDate(date);
    return `https://herbach.dnsalias.com/uc/uc${dateStr}.puz`;
  },
  'universal-sunday': (date: Date) => {
    const dateStr = formatDate(date);
    return `https://herbach.dnsalias.com/uc/ucs${dateStr}.puz`;
  },
  wsj: (date: Date) => {
    const dateStr = formatDate(date);
    return `https://herbach.dnsalias.com/wsj/wsj${dateStr}.puz`;
  },
  'wapo-sunday': (date: Date) => {
    const dateStr = formatDate(date);
    return `https://herbach.dnsalias.com/WaPo/wp${dateStr}.puz`;
  },
  jonesin: (date: Date) => {
    const dateStr = formatDate(date);
    return `https://herbach.dnsalias.com/Jonesin/jz${dateStr}.puz`;
  },
};

function formatDate(date: Date): string {
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function fetchPuzzle(url: string): Promise<ArrayBuffer | null> {
  const tmpFile = `/tmp/puzzle_${Date.now()}.puz`;
  try {
    execSync(`curl -s -f "${url}" -o "${tmpFile}"`, { timeout: 10000 });
    if (!existsSync(tmpFile)) {
      return null;
    }
    const buffer = readFileSync(tmpFile);
    unlinkSync(tmpFile);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  } catch {
    if (existsSync(tmpFile)) {
      try { unlinkSync(tmpFile); } catch { /* ignore cleanup errors */ }
    }
    return null;
  }
}

interface ParsedPuzzle {
  title: string;
  author?: string;
  clues: {
    across: Array<{ number: number; text: string; answer: string }>;
    down: Array<{ number: number; text: string; answer: string }>;
  };
}

function parsePuz(buffer: ArrayBuffer): ParsedPuzzle | null {
  try {
    const xdString = puzToXD(buffer);
    const json = xdToJSON(xdString);
    if (!json.report.success) {
      return null;
    }

    return {
      title: json.meta.title || 'Untitled',
      author: json.meta.author,
      clues: {
        across: json.clues.across.map((c) => ({
          number: c.number,
          text: c.body,
          answer: c.tiles.map((t) => (t.type === 'letter' ? t.letter : t.type === 'rebus' ? t.word : '')).join(''),
        })),
        down: json.clues.down.map((c) => ({
          number: c.number,
          text: c.body,
          answer: c.tiles.map((t) => (t.type === 'letter' ? t.letter : t.type === 'rebus' ? t.word : '')).join(''),
        })),
      },
    };
  } catch {
    return null;
  }
}

// Patterns to find numeric clue references
const NUMERIC_PATTERNS = [
  // Multi-clue with "and" - various formats
  { name: 'multi-and-across', regex: /((?:\d+[-–,\s]+)+)and\s+(\d+)\s*[-–]?\s*(Across|A)\b/gi },
  { name: 'multi-and-down', regex: /((?:\d+[-–,\s]+)+)and\s+(\d+)\s*[-–]?\s*(Down|D)\b/gi },

  // Multi-clue with "or" instead of "and"
  { name: 'multi-or-across', regex: /((?:\d+[-–,\s]+)+)or\s+(\d+)\s*[-–]?\s*(Across|A)\b/gi },
  { name: 'multi-or-down', regex: /((?:\d+[-–,\s]+)+)or\s+(\d+)\s*[-–]?\s*(Down|D)\b/gi },

  // Two clues joined - "N- and M-Across" or "N and M-Across"
  { name: 'two-clue-and', regex: /\b(\d+)\s*[-–]?\s*and\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi },

  // Hint/key to specific clues
  { name: 'hint-to-clues', regex: /(?:hint|clue|key)\s+to\s+(?:the\s+)?(?:(?:ends?|starts?|beginnings?|letters?|first|last|middle)\s+(?:of\s+)?)?(?:\d+[-–,\s]+)+(?:and|or)\s+\d+\s*[-–]?\s*(Across|Down|A|D)/gi },

  // Start/end of specific clues
  { name: 'start-of-clues', regex: /(?:start|beginning|first\s+(?:letters?|part))\s+of\s+((?:\d+[-–,\s]+)+)(?:and|or)\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)/gi },
  { name: 'end-of-clues', regex: /(?:end|last\s+(?:letters?|part))\s+of\s+((?:\d+[-–,\s]+)+)(?:and|or)\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)/gi },

  // "the clues for N-, M-, and K-Across"
  { name: 'clues-for', regex: /(?:the\s+)?clues?\s+for\s+((?:\d+[-–,\s]+)+)(?:and|or)\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)/gi },

  // "N-Across and N-Down" (different directions)
  { name: 'mixed-directions', regex: /(\d+)\s*[-–]?\s*(Across|A)\s+and\s+(\d+)\s*[-–]?\s*(Down|D)/gi },
  { name: 'mixed-directions-reverse', regex: /(\d+)\s*[-–]?\s*(Down|D)\s+and\s+(\d+)\s*[-–]?\s*(Across|A)/gi },

  // Just numbers followed by direction at end (no conjunction)
  { name: 'nums-dash-direction', regex: /\b(\d+[-–],\s*)+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi },

  // Sources pattern: "sources of N-, M-, and K-Across"
  { name: 'sources-of', regex: /sources?\s+of\s+((?:\d+[-–,\s]+)+)(?:and|or)\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)/gi },

  // Answers pattern: "the answers to N-, M-Across"
  { name: 'answers-to', regex: /(?:the\s+)?answers?\s+to\s+((?:\d+[-–,\s]+)+)(?:and|or)\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)/gi },

  // Category pattern: "a category for N-, M-, and K-Across"
  { name: 'category-for', regex: /(?:a\s+)?(?:punny\s+)?category\s+for\s+((?:\d+[-–,\s]+)+)(?:and|or)\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)/gi },

  // Range pattern: "N to M-Across"
  { name: 'range-to', regex: /\b(\d+)\s+to\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi },

  // All the N-Across clues
  { name: 'all-clues', regex: /all\s+(?:the\s+)?(?:\d+[-–,\s]+)+(?:and|or)\s+\d+\s*[-–]?\s*(Across|Down|A|D)/gi },

  // Any clue with numbers followed by Across or Down
  { name: 'any-numeric-ref', regex: /\b\d+\s*[-–]?\s*(Across|Down|A|D)\b/gi },
];

async function downloadAndAnalyzePuzzles() {
  const allClues: ClueInfo[] = [];

  // Generate dates for the last 8 weeks (56 days)
  const dates: Date[] = [];
  const today = new Date();
  for (let i = 0; i < 56; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date);
  }

  console.log(`Analyzing puzzles from ${dates.length} days across ${Object.keys(SOURCES).length} sources...`);
  console.log('');

  let puzzleCount = 0;

  for (const [sourceId, urlFn] of Object.entries(SOURCES)) {
    let sourceCount = 0;

    for (const date of dates) {
      // Skip dates that don't match source availability
      const dayOfWeek = date.getDay();
      if (sourceId === 'wapo-sunday' || sourceId === 'universal-sunday') {
        if (dayOfWeek !== 0) continue;
      } else if (sourceId === 'jonesin') {
        if (dayOfWeek !== 4) continue;
      } else if (sourceId === 'wsj') {
        if (dayOfWeek === 0) continue;
      }

      const url = urlFn(date);
      const buffer = await fetchPuzzle(url);

      if (!buffer) continue;

      const puzzle = parsePuz(buffer);
      if (!puzzle) continue;

      sourceCount++;
      puzzleCount++;

      // Extract all clues
      for (const clue of puzzle.clues.across) {
        allClues.push({
          source: sourceId,
          date: formatDateISO(date),
          puzzleTitle: puzzle.title,
          number: clue.number,
          direction: 'across',
          text: clue.text,
          answer: clue.answer,
        });
      }

      for (const clue of puzzle.clues.down) {
        allClues.push({
          source: sourceId,
          date: formatDateISO(date),
          puzzleTitle: puzzle.title,
          number: clue.number,
          direction: 'down',
          text: clue.text,
          answer: clue.answer,
        });
      }
    }

    console.log(`${sourceId}: ${sourceCount} puzzles downloaded`);
  }

  console.log('');
  console.log(`=== SUMMARY ===`);
  console.log(`Total puzzles: ${puzzleCount}`);
  console.log(`Total clues: ${allClues.length}`);
  console.log('');

  // Find clues with numeric references
  console.log(`=== ALL CLUES WITH NUMERIC REFERENCES ===`);
  console.log('');

  // Find any clue that has a number followed by Across/Down/A/D
  const cluesWithRefs: ClueInfo[] = [];
  const simpleRefRegex = /\b\d+\s*[-–]?\s*(Across|Down|A|D)\b/gi;

  for (const clue of allClues) {
    simpleRefRegex.lastIndex = 0;
    if (simpleRefRegex.test(clue.text)) {
      cluesWithRefs.push(clue);
    }
  }

  console.log(`Found ${cluesWithRefs.length} clues with numeric references`);
  console.log('');

  // Group by pattern type
  console.log(`=== PATTERN ANALYSIS ===`);
  console.log('');

  for (const pattern of NUMERIC_PATTERNS) {
    const matches: Array<{clue: ClueInfo, matchedText: string}> = [];

    for (const clue of cluesWithRefs) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match;
      while ((match = regex.exec(clue.text)) !== null) {
        matches.push({ clue, matchedText: match[0] });
      }
    }

    if (matches.length > 0) {
      console.log(`\n### ${pattern.name} (${matches.length} matches)`);
      console.log('-'.repeat(60));

      // Show unique matched texts
      const uniqueMatches = new Map<string, ClueInfo>();
      for (const m of matches) {
        if (!uniqueMatches.has(m.matchedText.toLowerCase())) {
          uniqueMatches.set(m.matchedText.toLowerCase(), m.clue);
        }
      }

      let shown = 0;
      for (const [matchedText, clue] of uniqueMatches) {
        if (shown >= 8) {
          console.log(`  ... and ${uniqueMatches.size - 8} more unique patterns`);
          break;
        }
        console.log(`  "${matchedText}"`);
        console.log(`    Full clue: "${clue.text.substring(0, 80)}${clue.text.length > 80 ? '...' : ''}"`);
        shown++;
      }
    }
  }

  // Find any clues that might not be matching our current patterns
  console.log('\n\n=== POTENTIALLY UNMATCHED PATTERNS ===');
  console.log('Looking for clues with unusual numeric reference formats...\n');

  // Our current main multi-clue pattern
  const currentPattern = /((?:\d+[-–,\s]+)+)and\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)/gi;

  const unmatchedMulti: ClueInfo[] = [];
  for (const clue of cluesWithRefs) {
    // Check if clue has multiple numbers
    const numbers = clue.text.match(/\b\d+\b/g);
    if (numbers && numbers.length >= 2) {
      // Check if it matches our current pattern
      currentPattern.lastIndex = 0;
      if (!currentPattern.test(clue.text)) {
        // Check if it might be a multi-clue reference that we're missing
        // Look for patterns like "N- and M-" or "N, M, and K-"
        if (/\d+[-–,\s]+(?:and|or)\s+\d+/.test(clue.text)) {
          unmatchedMulti.push(clue);
        }
      }
    }
  }

  if (unmatchedMulti.length > 0) {
    console.log(`Found ${unmatchedMulti.length} potentially unmatched multi-clue patterns:`);
    for (const clue of unmatchedMulti.slice(0, 15)) {
      console.log(`  [${clue.source} ${clue.date}] ${clue.number}-${clue.direction}:`);
      console.log(`    "${clue.text}"`);
    }
  } else {
    console.log('All multi-clue patterns appear to be matched!');
  }

  // Look for "or" instead of "and"
  console.log('\n\n=== CLUES WITH "OR" CONNECTORS ===');
  const orConnector = /((?:\d+[-–,\s]+)+)or\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)/gi;
  const orMatches: ClueInfo[] = [];

  for (const clue of cluesWithRefs) {
    orConnector.lastIndex = 0;
    if (orConnector.test(clue.text)) {
      orMatches.push(clue);
    }
  }

  if (orMatches.length > 0) {
    console.log(`Found ${orMatches.length} clues using "or" connector:`);
    for (const clue of orMatches.slice(0, 10)) {
      console.log(`  "${clue.text}"`);
    }
  }

  // Look for unusual separators or formats
  console.log('\n\n=== CLUES WITH UNUSUAL FORMATS ===');

  // Look for various patterns we might be missing
  const unusualPatterns = [
    { name: 'Two numbers with "and" no dash', regex: /\b(\d+)\s+and\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi },
    { name: 'Numbers with slash', regex: /\b(\d+)\/(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi },
    { name: 'Numbers with semicolon', regex: /\b(\d+)\s*;\s*(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi },
    { name: 'Just "the N-Across"', regex: /\bthe\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi },
    { name: 'Both N-Across and M-Down', regex: /\bboth\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\s+and\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi },
  ];

  for (const pattern of unusualPatterns) {
    const matches: ClueInfo[] = [];
    for (const clue of cluesWithRefs) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      if (regex.test(clue.text)) {
        matches.push(clue);
      }
    }
    if (matches.length > 0) {
      console.log(`\n${pattern.name} (${matches.length} matches):`);
      for (const clue of matches.slice(0, 5)) {
        console.log(`  "${clue.text.substring(0, 80)}${clue.text.length > 80 ? '...' : ''}"`);
      }
    }
  }
}

downloadAndAnalyzePuzzles().catch(console.error);
