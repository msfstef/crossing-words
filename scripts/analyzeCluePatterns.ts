#!/usr/bin/env npx tsx

/**
 * Script to download puzzles and analyze clue reference patterns.
 * Downloads puzzles from multiple sources and extracts all clues that
 * reference other clues or contain interesting patterns.
 */

import { puzToXD, xdToJSON } from 'xd-crossword-tools';

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

import { execSync } from 'child_process';
import { readFileSync, unlinkSync, existsSync } from 'fs';

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

// Patterns to look for in clues
const REFERENCE_PATTERNS = [
  // Direct clue number references
  { name: 'inline-reference', regex: /\b(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi },
  { name: 'see-reference', regex: /\b[Ss]ee\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi },
  { name: 'with-reference', regex: /\b[Ww]ith\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\s*,/gi },
  { name: 'possessive-reference', regex: /(\d+)\s*[-–]?\s*(Across|Down|A|D)['']s\b/gi },
  { name: 'multi-clue-reference', regex: /((?:\d+[-–,\s]+)+)and\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)/gi },

  // Starred clue patterns
  { name: 'starred-clue', regex: /^\*/i },
  { name: 'starred-reference', regex: /\bstarred\s+(?:clues?['']?\s*)?(?:answers?|entries?|clues?)\b/gi },
  { name: 'starred-hint', regex: /\b(?:hint|clue|key)\s+to\s+(?:the\s+)?starred\b/gi },

  // Theme patterns
  { name: 'theme-hint-multi', regex: /(?:hint|clue|key)\s+to\s+(?:the\s+)?(?:(?:ends?|starts?|beginnings?|letters?)\s+of\s+)?((?:\d+[-–,\s]+)+)and\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)/gi },
  { name: 'theme-marker', regex: /(?:and|or)\s+a\s+theme\s+(?:hint|answer|entry)\b/gi },
  { name: 'theme-revealer', regex: /\btheme\s+(?:revealer|reveal|answer)\b/gi },

  // Letter references
  { name: 'letter-single', regex: /(?:the\s+)?(\d+)(?:st|nd|rd|th)?\s+letter(?:\s+(?:here|of))?/gi },
  { name: 'letter-range', regex: /letters?\s+(\d+)\s*[-–]\s*(\d+)/gi },
  { name: 'last-letter', regex: /\b(?:last|final)\s+(?:letter|letters?)\b/gi },
  { name: 'first-letter', regex: /\b(?:first|initial)\s+(?:letter|letters?)\b/gi },
  { name: 'note-letter', regex: /\bnote\s+(?:the\s+)?(?:letter|letters)/gi },

  // Circled/shaded/special cells
  { name: 'circled-letters', regex: /\b(?:circled|shaded|highlighted)\s+(?:letters?|squares?|cells?)\b/gi },

  // Meta patterns
  { name: 'meta-answer', regex: /\bmeta\s+(?:answer|puzzle|solution)\b/gi },
  { name: 'bonus-answer', regex: /\bbonus\s+(?:answer|puzzle)\b/gi },

  // Answer spanning
  { name: 'answer-span-last', regex: /\b[Ll]ast\s+(\d+)\s+letters?\s*\+/gi },
  { name: 'answer-span-first', regex: /\+\s*(?:the\s+)?[Ff]irst\s+(\d+)\s+letters?\b/gi },

  // Contextual references
  { name: 'sounds-like', regex: /\b(?:sounds?\s+like|homophone\s+of|rhymes?\s+with)\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi },
  { name: 'anagram-of', regex: /\b(?:anagram)\s+of\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi },
  { name: 'part-of', regex: /\b(?:part|member|element)\s+(?:of|in)\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi },
  { name: 'like-reference', regex: /\b(?:like|unlike|similar\s+to|opposite\s+of)\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi },

  // Other common patterns
  { name: 'after-saying', regex: /\bafter\s+saying\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi },
  { name: 'precedes', regex: /\b(?:precedes|follows|comes\s+(?:before|after))\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi },
  { name: 'start-of', regex: /\bstart\s+of\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi },
  { name: 'end-of', regex: /\bend\s+of\s+(\d+)\s*[-–]?\s*(Across|Down|A|D)\b/gi },

  // Capitalized patterns that might be theme-related
  { name: 'capitalized-word', regex: /\b[A-Z]{2,}\b/g },

  // Question patterns suggesting theme
  { name: 'question-themed', regex: /\?$/g },

  // Ellipsis patterns (often part of multi-word answers)
  { name: 'ellipsis-start', regex: /^\.{3}|^…/g },
  { name: 'ellipsis-end', regex: /\.{3}$|…$/g },
];

async function downloadAndAnalyzePuzzles() {
  const allClues: ClueInfo[] = [];
  const patternMatches = new Map<string, ClueInfo[]>();

  // Initialize pattern match storage
  for (const pattern of REFERENCE_PATTERNS) {
    patternMatches.set(pattern.name, []);
  }

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
  let errorCount = 0;

  for (const [sourceId, urlFn] of Object.entries(SOURCES)) {
    let sourceCount = 0;
    let sourceErrors = 0;

    for (const date of dates) {
      // Skip dates that don't match source availability
      const dayOfWeek = date.getDay();
      if (sourceId === 'wapo-sunday' || sourceId === 'universal-sunday') {
        if (dayOfWeek !== 0) continue; // Sunday only
      } else if (sourceId === 'jonesin') {
        if (dayOfWeek !== 4) continue; // Thursday only
      } else if (sourceId === 'wsj') {
        if (dayOfWeek === 0) continue; // No Sunday WSJ
      }

      const url = urlFn(date);
      const buffer = await fetchPuzzle(url);

      if (!buffer) {
        sourceErrors++;
        continue;
      }

      const puzzle = parsePuz(buffer);
      if (!puzzle) {
        sourceErrors++;
        continue;
      }

      sourceCount++;
      puzzleCount++;

      // Extract all clues
      for (const clue of puzzle.clues.across) {
        const clueInfo: ClueInfo = {
          source: sourceId,
          date: formatDateISO(date),
          puzzleTitle: puzzle.title,
          number: clue.number,
          direction: 'across',
          text: clue.text,
          answer: clue.answer,
        };
        allClues.push(clueInfo);

        // Check all patterns
        for (const pattern of REFERENCE_PATTERNS) {
          pattern.regex.lastIndex = 0;
          if (pattern.regex.test(clue.text)) {
            patternMatches.get(pattern.name)!.push(clueInfo);
          }
        }
      }

      for (const clue of puzzle.clues.down) {
        const clueInfo: ClueInfo = {
          source: sourceId,
          date: formatDateISO(date),
          puzzleTitle: puzzle.title,
          number: clue.number,
          direction: 'down',
          text: clue.text,
          answer: clue.answer,
        };
        allClues.push(clueInfo);

        // Check all patterns
        for (const pattern of REFERENCE_PATTERNS) {
          pattern.regex.lastIndex = 0;
          if (pattern.regex.test(clue.text)) {
            patternMatches.get(pattern.name)!.push(clueInfo);
          }
        }
      }
    }

    console.log(`${sourceId}: ${sourceCount} puzzles downloaded (${sourceErrors} failed)`);
    errorCount += sourceErrors;
  }

  console.log('');
  console.log(`=== SUMMARY ===`);
  console.log(`Total puzzles: ${puzzleCount}`);
  console.log(`Total clues: ${allClues.length}`);
  console.log(`Failed downloads: ${errorCount}`);
  console.log('');

  // Print pattern matches
  console.log(`=== PATTERN ANALYSIS ===`);
  console.log('');

  for (const pattern of REFERENCE_PATTERNS) {
    const matches = patternMatches.get(pattern.name)!;
    if (matches.length > 0) {
      console.log(`\n### ${pattern.name} (${matches.length} matches)`);
      console.log('-'.repeat(60));

      // Show unique examples (max 10)
      const uniqueTexts = new Set<string>();
      let shown = 0;
      for (const match of matches) {
        if (!uniqueTexts.has(match.text) && shown < 10) {
          uniqueTexts.add(match.text);
          console.log(`  [${match.source} ${match.date}] ${match.number}-${match.direction}:`);
          console.log(`    "${match.text}"`);
          if (match.answer) {
            console.log(`    Answer: ${match.answer}`);
          }
          shown++;
        }
      }
      if (matches.length > 10) {
        console.log(`  ... and ${matches.length - 10} more matches`);
      }
    }
  }

  // Print starred clue analysis separately
  console.log('\n\n=== STARRED CLUE ANALYSIS ===');
  const starredClues = patternMatches.get('starred-clue')!;
  const starredReferences = patternMatches.get('starred-reference')!;
  const starredHints = patternMatches.get('starred-hint')!;

  console.log(`\nStarred clues found: ${starredClues.length}`);
  console.log(`References to starred clues: ${starredReferences.length}`);
  console.log(`Hints to starred clues: ${starredHints.length}`);

  // Group starred clues by puzzle
  const starredByPuzzle = new Map<string, ClueInfo[]>();
  for (const clue of starredClues) {
    const key = `${clue.source}-${clue.date}`;
    if (!starredByPuzzle.has(key)) {
      starredByPuzzle.set(key, []);
    }
    starredByPuzzle.get(key)!.push(clue);
  }

  console.log(`\nPuzzles with starred clues: ${starredByPuzzle.size}`);

  // For each puzzle with starred clues, find the revealer
  console.log('\n--- Starred clue puzzles with revealers ---');
  for (const [puzzleKey, clues] of starredByPuzzle) {
    console.log(`\n[${puzzleKey}] "${clues[0].puzzleTitle}"`);
    console.log('  Starred clues:');
    for (const c of clues) {
      console.log(`    ${c.number}-${c.direction}: "${c.text.substring(0, 60)}${c.text.length > 60 ? '...' : ''}"`);
      if (c.answer) console.log(`      Answer: ${c.answer}`);
    }

    // Find clues that reference starred answers
    const relatedRefs = [...starredReferences, ...starredHints].filter(
      (r) => r.source === clues[0].source && r.date === clues[0].date
    );
    if (relatedRefs.length > 0) {
      console.log('  Revealer clues:');
      for (const r of relatedRefs) {
        console.log(`    ${r.number}-${r.direction}: "${r.text}"`);
        if (r.answer) console.log(`      Answer: ${r.answer}`);
      }
    }
  }

  // Find all unique ways starred clues are referenced
  console.log('\n\n=== UNIQUE STARRED REFERENCE PATTERNS ===');
  const uniqueStarredPatterns = new Set<string>();
  for (const ref of [...starredReferences, ...starredHints]) {
    // Extract the key phrase
    const lowerText = ref.text.toLowerCase();
    const starredIndex = lowerText.indexOf('starred');
    if (starredIndex !== -1) {
      // Get context around "starred"
      const start = Math.max(0, starredIndex - 20);
      const end = Math.min(lowerText.length, starredIndex + 50);
      let context = lowerText.substring(start, end);
      if (start > 0) context = '...' + context;
      if (end < lowerText.length) context = context + '...';
      uniqueStarredPatterns.add(context);
    }
  }
  for (const pattern of uniqueStarredPatterns) {
    console.log(`  "${pattern}"`);
  }

  // Find any other interesting patterns we might have missed
  console.log('\n\n=== POTENTIAL NEW PATTERNS ===');
  console.log('Looking for clues with specific keywords that might reference other clues...');

  const interestingKeywords = [
    /\bthis\s+(?:answer|clue|entry)\b/gi,
    /\bthese\s+(?:answers|clues|entries)\b/gi,
    /\bboth\s+(?:answers|clues)\b/gi,
    /\beach\s+(?:answer|clue|starred|theme)\b/gi,
    /\ball\s+(?:starred|theme)\b/gi,
    /\bevery\s+(?:starred|theme)\b/gi,
    /\bthe\s+long(?:est)?\s+(?:answers|entries|clues)\b/gi,
    /\bthe\s+(?:four|five|six|seven|eight)\s+(?:longest|theme)?\s*(?:answers|entries|clues)\b/gi,
    /\bshaded\s+(?:letters|squares|cells|areas)\b/gi,
    /\bcircled\s+(?:letters|squares|cells)\b/gi,
    /\bitalicized\b/gi,
    /\bboldface\b/gi,
    /\bunderlined\b/gi,
    /\bnote\s+(?:the\s+)?(?:\d+|first|last|middle)\b/gi,
  ];

  for (const keyword of interestingKeywords) {
    const matches: ClueInfo[] = [];
    for (const clue of allClues) {
      keyword.lastIndex = 0;
      if (keyword.test(clue.text)) {
        matches.push(clue);
      }
    }
    if (matches.length > 0) {
      console.log(`\n"${keyword.source}" (${matches.length} matches):`);
      const shown = matches.slice(0, 5);
      for (const m of shown) {
        console.log(`  [${m.source} ${m.date}] ${m.number}-${m.direction}: "${m.text}"`);
      }
    }
  }
}

downloadAndAnalyzePuzzles().catch(console.error);
