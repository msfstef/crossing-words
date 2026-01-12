# Phase 7: Check/Reveal - Research

**Researched:** 2026-01-12
**Domain:** Internal application logic - verification system with CRDT sync
**Confidence:** HIGH

<research_summary>
## Summary

Phase 7 is commodity work that extends existing codebase patterns. No external libraries or specialized knowledge required - this is internal application logic using patterns already established in Phases 4-6.

The key decisions are architectural: how to model verified/error state in the existing CRDT structure, and how to integrate verification with the keyboard navigation system.

**Primary recommendation:** Extend the existing Y.Map pattern with a new "verified" map. Use CSS classes for visual feedback. Modify autoAdvance() to skip verified cells.
</research_summary>

<standard_stack>
## Standard Stack

No new libraries needed. Uses existing codebase dependencies:

### Core (Already Installed)
| Library | Version | Purpose | Why Relevant |
|---------|---------|---------|--------------|
| yjs | existing | CRDT state | Verified state sync |
| react | existing | UI components | Toolbar buttons |
| y-indexeddb | existing | Persistence | Verified state persists |
| y-webrtc | existing | P2P sync | Verified state syncs |

### No Additional Dependencies
This phase uses 100% internal patterns from existing code.
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### CRDT State Structure Options

**Option A: Single Y.Map with prefixed keys (RECOMMENDED)**
```typescript
// Extend existing entries pattern
const entries = getEntriesMap(doc);     // "row,col" → "A"
const verified = getVerifiedMap(doc);   // "row,col" → "revealed" | "checked"
const errors = getErrorsMap(doc);       // "row,col" → true (removed when fixed)
```
- Pro: Consistent with existing pattern
- Pro: Easy to query verification status
- Pro: Errors can be cleared independently

**Option B: Combined in single map**
```typescript
// "row,col" → { letter: "A", verified?: "checked" | "revealed" }
```
- Con: More complex sync logic
- Con: Conflicts with existing entries pattern

**DECISION: Option A** - Separate Y.Maps for entries, verified, and errors.

### Cell States

```
                    ┌─────────────────────────────────────┐
                    │          CELL STATES                │
                    └─────────────────────────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            ▼                        ▼                        ▼
       ┌─────────┐            ┌───────────┐           ┌────────────┐
       │  Empty  │            │  Filled   │           │  Verified  │
       │         │            │           │           │  (Locked)  │
       └─────────┘            └───────────┘           └────────────┘
                                     │                      ▲
                              ┌──────┴──────┐               │
                              ▼             ▼               │
                       ┌───────────┐ ┌───────────┐          │
                       │  Correct  │ │   Error   │          │
                       │ (hidden)  │ │   (red)   │          │
                       └───────────┘ └───────────┘          │
                              │             │               │
                              │   Check     │   Fix         │
                              └─────────────┼───────────────┘
                                            │
                                     Reveal goes directly
                                     to Verified state
```

**State Transitions:**
1. Empty → Filled: User types letter
2. Filled → Error: Check reveals mismatch (stays editable)
3. Error → Filled: User corrects (error cleared)
4. Filled → Verified: Check confirms correct OR Reveal
5. Verified: Terminal state (locked, unskippable)

### Recommended Project Structure

```
src/
├── components/
│   ├── CrosswordGrid.tsx    # Add verified/error CSS classes
│   ├── CrosswordGrid.css    # Add .cell--verified, .cell--error
│   └── Toolbar.tsx          # NEW: Check/Reveal buttons
├── hooks/
│   ├── usePuzzleState.ts    # Modify autoAdvance for skip
│   └── useVerification.ts   # NEW: Check/reveal logic
├── crdt/
│   └── puzzleDoc.ts         # Add getVerifiedMap(), getErrorsMap()
└── utils/
    └── verification.ts      # NEW: Comparison utilities
```

### Pattern 1: Verification Logic
**What:** Pure functions that compare entries to solutions
**When to use:** All check operations

```typescript
// src/utils/verification.ts
export function checkCell(
  puzzle: Puzzle,
  row: number,
  col: number,
  userEntry: string | undefined
): 'correct' | 'incorrect' | 'empty' {
  const solution = puzzle.grid[row][col].letter;
  if (!userEntry) return 'empty';
  return userEntry === solution ? 'correct' : 'incorrect';
}

export function checkWord(
  puzzle: Puzzle,
  cells: { row: number; col: number }[],
  entries: Map<string, string>
): { correct: string[]; incorrect: string[]; empty: string[] } {
  const result = { correct: [], incorrect: [], empty: [] };
  for (const { row, col } of cells) {
    const key = `${row},${col}`;
    const status = checkCell(puzzle, row, col, entries.get(key));
    result[status].push(key);
  }
  return result;
}
```

### Pattern 2: CRDT Verification State
**What:** Synced state for verified/error cells
**When to use:** After check or reveal actions

```typescript
// src/crdt/puzzleDoc.ts (additions)
export type VerifiedType = 'checked' | 'revealed';
export type VerifiedMap = Y.Map<VerifiedType>;
export type ErrorsMap = Y.Map<boolean>;

export function getVerifiedMap(doc: Y.Doc): VerifiedMap {
  return doc.getMap('verified');
}

export function getErrorsMap(doc: Y.Doc): ErrorsMap {
  return doc.getMap('errors');
}
```

### Pattern 3: Skip Verified in Navigation
**What:** Modified autoAdvance to skip locked cells
**When to use:** Typing and navigation

```typescript
// In usePuzzleState.ts, modify findNextCellWithClue
const findNextCellWithClue = useCallback(
  (row: number, col: number, deltaRow: number, deltaCol: number, dir: Direction) => {
    let r = row + deltaRow;
    let c = col + deltaCol;

    while (isValidCell(r, c)) {
      const cell = puzzle.grid[r][c];
      const key = `${r},${c}`;

      // Skip black cells
      if (cell.isBlack) {
        r += deltaRow;
        c += deltaCol;
        continue;
      }

      // Skip verified cells (NEW)
      if (verifiedCells.has(key)) {
        r += deltaRow;
        c += deltaCol;
        continue;
      }

      // Check for clue in direction
      if (hasClueInDirection(r, c, dir)) {
        return { row: r, col: c };
      }

      r += deltaRow;
      c += deltaCol;
    }
    return null;
  },
  [puzzle, verifiedCells]
);
```

### Anti-Patterns to Avoid
- **Storing verification in puzzle object:** Puzzle is immutable source data
- **Local-only verification state:** Must sync via CRDT for collaboration
- **Blocking on verify action:** Keep UI responsive, async sync
- **Complex nested CRDT structure:** Keep flat maps, avoid nested objects
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CRDT sync | Custom sync logic | Yjs Y.Map | Already handles conflicts, persistence, P2P |
| React integration | Manual state sync | useSyncExternalStore | Already implemented pattern in codebase |
| Keyboard navigation | New system | Existing usePuzzleState | Modify, don't replace |

**Key insight:** This phase is 100% extension of existing patterns. No new libraries, no new paradigms. The codebase already has all required infrastructure.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Race Condition on Concurrent Check
**What goes wrong:** Two users check simultaneously, state conflicts
**Why it happens:** Check action modifies multiple cells atomically
**How to avoid:** Use Y.Doc.transact() for atomic batch updates
**Warning signs:** Intermittent state inconsistency after check actions

```typescript
// CORRECT: Atomic batch update
doc.transact(() => {
  for (const key of correctKeys) {
    verifiedMap.set(key, 'checked');
  }
  for (const key of incorrectKeys) {
    errorsMap.set(key, true);
  }
});
```

### Pitfall 2: Error State Not Clearing
**What goes wrong:** Error highlight persists after user fixes letter
**Why it happens:** Error state not observed for changes
**How to avoid:** Clear error when entry changes at that position
**Warning signs:** Red cells that are actually correct now

```typescript
// In entry observer
entriesMap.observe((event) => {
  event.changes.keys.forEach((change, key) => {
    // Clear error when entry changes
    if (errorsMap.has(key)) {
      errorsMap.delete(key);
    }
  });
});
```

### Pitfall 3: Auto-Check Performance
**What goes wrong:** UI lag on every keystroke with auto-check enabled
**Why it happens:** Checking entire puzzle on each input
**How to avoid:** Only check the cell that changed
**Warning signs:** Noticeable delay when typing with auto-check on

```typescript
// CORRECT: Check only changed cell
const handleEntryChange = (row: number, col: number, letter: string) => {
  if (autoCheckEnabled) {
    const result = checkCell(puzzle, row, col, letter);
    if (result === 'incorrect') {
      errorsMap.set(`${row},${col}`, true);
    }
  }
};
```

### Pitfall 4: Verified State Lost on Page Reload
**What goes wrong:** Verified cells become editable after refresh
**Why it happens:** Verified map not included in IndexedDB persistence
**How to avoid:** Ensure verified and errors maps are in same Y.Doc
**Warning signs:** Green checkmarks disappear on reload

```typescript
// All maps in same doc = same persistence
const doc = createPuzzleDoc(puzzleId);
const entries = getEntriesMap(doc);    // persisted
const verified = getVerifiedMap(doc);  // persisted (same doc)
const errors = getErrorsMap(doc);      // persisted (same doc)
```

### Pitfall 5: Backspace on Verified Cell
**What goes wrong:** User expects backspace to work, nothing happens
**Why it happens:** Cell is locked but no visual/audio feedback
**How to avoid:** Provide feedback (shake animation, subtle sound, or skip to previous unverified)
**Warning signs:** Users repeatedly pressing backspace confused

```typescript
// Option: Skip back to previous unverified cell
if (key === 'Backspace') {
  if (isVerified(selectedCell)) {
    const prevUnverified = findPreviousUnverifiedCell();
    if (prevUnverified) setSelectedCell(prevUnverified);
    return;
  }
  // ... normal backspace logic
}
```
</common_pitfalls>

<code_examples>
## Code Examples

Patterns derived from existing codebase structure:

### Verification Hook
```typescript
// src/hooks/useVerification.ts
import { useCallback } from 'react';
import { Puzzle } from '../types/puzzle';
import { checkCell, checkWord } from '../utils/verification';

export function useVerification(
  puzzle: Puzzle,
  entries: Map<string, string>,
  verifiedMap: Y.Map<VerifiedType>,
  errorsMap: Y.Map<boolean>,
  doc: Y.Doc
) {
  const checkLetter = useCallback((row: number, col: number) => {
    const key = `${row},${col}`;
    const result = checkCell(puzzle, row, col, entries.get(key));

    doc.transact(() => {
      if (result === 'correct') {
        verifiedMap.set(key, 'checked');
        errorsMap.delete(key);
      } else if (result === 'incorrect') {
        errorsMap.set(key, true);
      }
    });
  }, [puzzle, entries, verifiedMap, errorsMap, doc]);

  const revealLetter = useCallback((row: number, col: number) => {
    const key = `${row},${col}`;
    const solution = puzzle.grid[row][col].letter;

    if (solution) {
      doc.transact(() => {
        entries.set(key, solution);
        verifiedMap.set(key, 'revealed');
        errorsMap.delete(key);
      });
    }
  }, [puzzle, entries, verifiedMap, errorsMap, doc]);

  // Similar for checkWord, checkPuzzle, revealWord, revealPuzzle

  return { checkLetter, revealLetter, checkWord, revealWord, checkPuzzle, revealPuzzle };
}
```

### CSS for Verified/Error States
```css
/* src/components/CrosswordGrid.css */
.cell--verified {
  background-color: rgba(76, 175, 80, 0.15); /* Subtle green tint */
  pointer-events: none; /* Visual hint it's locked */
}

.cell--verified::after {
  content: '';
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 6px;
  height: 6px;
  background-color: #4caf50;
  border-radius: 50%;
}

.cell--error {
  background-color: rgba(244, 67, 54, 0.25);
  animation: shake 0.2s ease-in-out;
}

.cell--error .cell-letter {
  color: #f44336;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}
```

### Toolbar Component
```typescript
// src/components/Toolbar.tsx
import { useState } from 'react';

interface ToolbarProps {
  onCheckLetter: () => void;
  onCheckWord: () => void;
  onCheckPuzzle: () => void;
  onRevealLetter: () => void;
  onRevealWord: () => void;
  onRevealPuzzle: () => void;
  autoCheckEnabled: boolean;
  onAutoCheckToggle: () => void;
}

export function Toolbar({
  onCheckLetter, onCheckWord, onCheckPuzzle,
  onRevealLetter, onRevealWord, onRevealPuzzle,
  autoCheckEnabled, onAutoCheckToggle
}: ToolbarProps) {
  const [showCheckMenu, setShowCheckMenu] = useState(false);
  const [showRevealMenu, setShowRevealMenu] = useState(false);

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button
          className="toolbar-button"
          onClick={() => setShowCheckMenu(!showCheckMenu)}
        >
          Check
        </button>
        {showCheckMenu && (
          <div className="toolbar-dropdown">
            <button onClick={() => { onCheckLetter(); setShowCheckMenu(false); }}>
              Letter
            </button>
            <button onClick={() => { onCheckWord(); setShowCheckMenu(false); }}>
              Word
            </button>
            <button onClick={() => { onCheckPuzzle(); setShowCheckMenu(false); }}>
              Puzzle
            </button>
          </div>
        )}
      </div>

      <div className="toolbar-group">
        <button
          className="toolbar-button"
          onClick={() => setShowRevealMenu(!showRevealMenu)}
        >
          Reveal
        </button>
        {showRevealMenu && (
          <div className="toolbar-dropdown">
            <button onClick={() => { onRevealLetter(); setShowRevealMenu(false); }}>
              Letter
            </button>
            <button onClick={() => { onRevealWord(); setShowRevealMenu(false); }}>
              Word
            </button>
            <button onClick={() => { onRevealPuzzle(); setShowRevealMenu(false); }}>
              Puzzle
            </button>
          </div>
        )}
      </div>

      <label className="toolbar-toggle">
        <input
          type="checkbox"
          checked={autoCheckEnabled}
          onChange={onAutoCheckToggle}
        />
        Auto-check
      </label>
    </div>
  );
}
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

No external ecosystem changes relevant to this phase. This is internal application logic.

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A | N/A | N/A | N/A |

**Status:** Codebase patterns established in Phases 4-6 are current and appropriate.
</sota_updates>

<open_questions>
## Open Questions

1. **Auto-check state: local or synced?**
   - What we know: Could be either - user preference vs shared session setting
   - What's unclear: Does one person's auto-check affect others' experience?
   - Recommendation: Local only (personal preference, doesn't affect others)

2. **Reveal confirmation dialog?**
   - What we know: Reveals are permanent, could accidentally reveal puzzle
   - What's unclear: Is confirmation annoying for single letter reveals?
   - Recommendation: Confirm only for "Reveal Puzzle", not letter/word

3. **Error highlighting duration?**
   - What we know: Context says "stays until you fix it"
   - What's unclear: Should it also clear after N seconds as alternative?
   - Recommendation: Keep as specified - clear only when fixed (simpler, clearer UX)
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- Codebase exploration: `/src/crdt/puzzleDoc.ts`, `/src/hooks/useCrdtPuzzle.ts`
- Phase context: `.planning/phases/07-check-reveal/07-CONTEXT.md`
- Project state: `.planning/STATE.md`

### Secondary (MEDIUM confidence)
- React patterns: useSyncExternalStore usage in codebase
- Yjs patterns: Y.Map, Y.Doc.transact() from existing implementation

### Tertiary (LOW confidence - needs validation)
- None - all recommendations based on existing codebase patterns
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Internal application logic (no external deps)
- Ecosystem: N/A (uses existing stack)
- Patterns: CRDT state extension, React hooks, CSS styling
- Pitfalls: Race conditions, state persistence, UX edge cases

**Confidence breakdown:**
- Standard stack: HIGH - no changes needed
- Architecture: HIGH - extends existing patterns directly
- Pitfalls: HIGH - derived from CRDT/React patterns in codebase
- Code examples: HIGH - adapted from existing codebase code

**Research date:** 2026-01-12
**Valid until:** N/A (internal patterns, not external ecosystem)
</metadata>

---

*Phase: 07-check-reveal*
*Research completed: 2026-01-12*
*Ready for planning: yes*
