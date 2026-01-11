# Phase 4: CRDT State - Research

**Researched:** 2026-01-11
**Domain:** CRDT-based collaborative state management with Yjs
**Confidence:** HIGH

<research_summary>
## Summary

Researched the CRDT ecosystem for building collaborative real-time state sync in a crossword application. The standard approach uses **Yjs** as the CRDT library with **Y.Map** for grid-based data structures, combined with **y-indexeddb** for offline persistence.

Yjs is the clear winner over Automerge for this use case: faster performance, better memory efficiency, proven in production (JupyterLab, Tiptap), and a mature provider ecosystem (WebRTC, WebSocket, IndexedDB). The crossword grid maps naturally to a flat Y.Map with `"row,col"` string keys—simpler and more performant than nested structures.

Key finding: Don't hand-roll conflict resolution, sync protocols, or persistence. Yjs handles all of this with battle-tested implementations. For React integration, use **zustand-middleware-yjs** or direct Y.Map observation with custom hooks—avoid tight coupling between React components and Yjs types.

**Primary recommendation:** Use Yjs + Y.Map with flat key structure (`"row,col"` → entry value), y-indexeddb for persistence, and Awareness for presence (Phase 6). Defer provider choice (WebRTC vs WebSocket) to Phase 5.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| yjs | 13.6.29 | CRDT framework | Fastest JS CRDT, proven in production, rich ecosystem |
| y-indexeddb | 9.0.12 | Browser persistence | Seamless offline support, auto-sync on reconnect |

### Supporting (Phase 5-6, but good to know)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| y-webrtc | 10.3.0 | P2P provider | Peer-to-peer sync (Phase 5) |
| y-websocket | latest | Server provider | If central server preferred over P2P |
| zustand-middleware-yjs | latest | React state bridge | Cleanly separates React state from Yjs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Yjs | Automerge | Automerge has JSON-like API but slower performance, higher memory usage, and WASM dependency |
| Y.Map (flat) | Nested Y.Map | Nested maps add complexity; flat `"row,col"` keys sufficient for grid |
| zustand-middleware-yjs | valtio-yjs | Both work; zustand is already used in crossword projects, middleware is composable |
| y-indexeddb | Custom localStorage | IndexedDB handles large documents better, y-indexeddb is battle-tested |

**Installation:**
```bash
npm install yjs y-indexeddb
# Phase 5 will add: y-webrtc or y-websocket
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
src/
├── crdt/
│   ├── puzzleDoc.ts       # Y.Doc initialization, schema definition
│   ├── puzzleSync.ts      # Sync utilities (encode/decode updates)
│   └── providers.ts       # Provider management (Phase 5)
├── hooks/
│   ├── usePuzzleSync.ts   # React hook for CRDT-synced puzzle state
│   └── useAwareness.ts    # Presence hook (Phase 6)
└── stores/
    └── puzzleStore.ts     # Zustand store (may integrate via middleware)
```

### Pattern 1: Flat Y.Map for Grid State
**What:** Store cell entries in a single Y.Map with `"row,col"` string keys
**When to use:** Grid-based data where cells are independently updated
**Example:**
```typescript
// Source: Yjs docs + crossword domain
import * as Y from 'yjs'

const ydoc = new Y.Doc()
const entries = ydoc.getMap<string>('entries') // Y.Map<string>

// Set a cell value
entries.set('3,7', 'A')  // Row 3, Col 7 = 'A'

// Get a cell value
const value = entries.get('3,7')  // 'A'

// Delete a cell value (clear)
entries.delete('3,7')

// Observe changes
entries.observe(event => {
  event.keysChanged.forEach(key => {
    const [row, col] = key.split(',').map(Number)
    const newValue = entries.get(key)
    // Update React state or trigger re-render
  })
})
```

### Pattern 2: Decouple React from Yjs
**What:** Use hooks/middleware to bridge Yjs and React state
**When to use:** Always—direct coupling leads to bugs and testing difficulties
**Example:**
```typescript
// Source: zustand-middleware-yjs pattern
import { create } from 'zustand'
import { yjs } from 'zustand-middleware-yjs'
import * as Y from 'yjs'

const ydoc = new Y.Doc()

interface PuzzleState {
  entries: Record<string, string>
  setEntry: (key: string, value: string) => void
  clearEntry: (key: string) => void
}

// Option A: Zustand middleware (automatic sync)
const usePuzzleStore = create<PuzzleState>(
  yjs(ydoc, 'puzzle', (set) => ({
    entries: {},
    setEntry: (key, value) => set(state => ({
      entries: { ...state.entries, [key]: value }
    })),
    clearEntry: (key) => set(state => {
      const { [key]: _, ...rest } = state.entries
      return { entries: rest }
    })
  }))
)

// Option B: Custom hook with manual sync (more control)
function usePuzzleEntries() {
  const [entries, setEntries] = useState<Map<string, string>>(new Map())
  const ymap = useRef(ydoc.getMap<string>('entries'))

  useEffect(() => {
    // Initial load
    setEntries(new Map(ymap.current.entries()))

    // Subscribe to changes
    const observer = () => {
      setEntries(new Map(ymap.current.entries()))
    }
    ymap.current.observe(observer)
    return () => ymap.current.unobserve(observer)
  }, [])

  const setEntry = useCallback((key: string, value: string) => {
    ymap.current.set(key, value)
  }, [])

  return { entries, setEntry }
}
```

### Pattern 3: Persistence with y-indexeddb
**What:** Auto-persist document to IndexedDB for offline support
**When to use:** Always—enables offline editing and faster reload
**Example:**
```typescript
// Source: y-indexeddb docs
import { IndexeddbPersistence } from 'y-indexeddb'

const ydoc = new Y.Doc()
const persistence = new IndexeddbPersistence('puzzle-{puzzleId}', ydoc)

// Wait for persistence to load before rendering
persistence.on('synced', () => {
  console.log('Document loaded from IndexedDB')
  // Now safe to use ydoc.getMap('entries')
})

// Later: Clear stored data when puzzle changes
persistence.clearData()
```

### Pattern 4: Last-Write-Wins via Y.Map Semantics
**What:** Yjs Y.Map naturally implements LWW for same-key conflicts
**When to use:** When concurrent edits to same cell should resolve to last edit
**Why it works:**
```
Y.Map resolves concurrent set() calls using Lamport timestamps.
If User A sets ('3,7', 'A') and User B sets ('3,7', 'B') concurrently,
the one with the higher {clientId, clock} wins deterministically.
All peers converge to the same value without manual conflict resolution.
```

### Anti-Patterns to Avoid
- **Creating new Y.Doc per cell:** Use ONE Y.Doc per puzzle, ONE Y.Map for all entries
- **Storing entire puzzle state in single key:** Prevents granular sync, any change sends everything
- **Nested Y.Map for grid:** Adds complexity; flat key pattern is simpler and performant
- **Direct Yjs access in React components:** Creates tight coupling, testing headaches
- **JSON.stringify for Y.Map values:** Unnecessary—Y.Map accepts primitives directly
- **Polling for changes:** Use observers; polling defeats CRDT efficiency
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conflict resolution | Custom merge logic | Y.Map's built-in LWW | Yjs uses Lamport timestamps, handles all edge cases |
| Sync protocol | Custom diff/patch system | `Y.encodeStateAsUpdate()` / `Y.applyUpdate()` | Order-independent, delta-efficient, proven |
| Offline persistence | Custom localStorage sync | y-indexeddb | Handles IndexedDB complexity, concurrent tabs, auto-sync |
| Presence/cursors | Custom broadcast | Awareness protocol | Part of Yjs ecosystem, integrates with providers |
| Undo/redo | Custom history stack | Y.UndoManager | Captures CRDT operations, not just state snapshots |

**Key insight:** Yjs has solved distributed state sync. The YATA algorithm (Yjs's CRDT) handles concurrent edits, network partitions, offline editing, and eventual consistency. Any custom solution will be slower, buggier, and harder to maintain. The crossword grid is actually a simple case—single-character cells, no ordering requirements—which Yjs handles trivially.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Not Waiting for Persistence Sync
**What goes wrong:** Reading from Y.Doc before IndexedDB loads returns empty state
**Why it happens:** `IndexeddbPersistence` loads asynchronously
**How to avoid:** Listen for `'synced'` event before initializing React state
**Warning signs:** Puzzle appears empty on refresh, then populates after delay

### Pitfall 2: Multiple Y.Doc Instances for Same Data
**What goes wrong:** Changes don't sync, state diverges
**Why it happens:** Creating new Y.Doc in useEffect without cleanup, or in multiple components
**How to avoid:** Create Y.Doc once at module level or in context provider; pass down via props/context
**Warning signs:** Console shows multiple provider connections, changes disappear

### Pitfall 3: Frequent Key Updates Bloat Document
**What goes wrong:** Document size grows unexpectedly, sync slows
**Why it happens:** Y.Map retains history of all key changes; alternating updates to same keys accumulates
**How to avoid:** Crossword grid has fixed cells—this is actually fine. Would matter for dynamic key sets
**Warning signs:** `Y.encodeStateAsUpdate()` returns increasingly large arrays

### Pitfall 4: Mixing Yjs State and React State
**What goes wrong:** State gets out of sync, changes lost, UI doesn't update
**Why it happens:** Storing derived state in React useState alongside Yjs
**How to avoid:** Single source of truth—either Yjs drives React (via observers) or middleware handles sync
**Warning signs:** Manual `setState` calls that duplicate Yjs data

### Pitfall 5: Not Handling Provider Disconnection
**What goes wrong:** User thinks they're syncing but changes are only local
**Why it happens:** Network disconnect without UI feedback
**How to avoid:** Monitor provider status, show offline indicator (Phase 5-6 concern)
**Warning signs:** Changes sync when provider reconnects but user didn't know they were offline

### Pitfall 6: Forgetting to Clean Up Observers
**What goes wrong:** Memory leaks, stale state updates, React errors
**Why it happens:** `observe()` without corresponding `unobserve()` in cleanup
**How to avoid:** Always return cleanup function from useEffect that calls unobserve
**Warning signs:** "Can't perform a React state update on an unmounted component"
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources:

### Basic Y.Doc + Y.Map Setup
```typescript
// Source: Yjs docs
import * as Y from 'yjs'

// Create document (do this ONCE per puzzle)
const ydoc = new Y.Doc()

// Get shared map for cell entries
const entries = ydoc.getMap<string>('entries')

// Set value
entries.set('0,0', 'A')

// Get value
const value = entries.get('0,0') // 'A' or undefined

// Delete value
entries.delete('0,0')

// Check existence
entries.has('0,0') // false

// Get all entries
const all = entries.toJSON() // { '0,0': 'A', '2,3': 'B', ... }
```

### Observing Changes
```typescript
// Source: Yjs docs
entries.observe(event => {
  // event.keysChanged is a Set<string> of changed keys
  event.keysChanged.forEach(key => {
    const change = event.changes.keys.get(key)
    // change.action: 'add' | 'update' | 'delete'
    // change.oldValue: previous value (for update/delete)

    const newValue = entries.get(key) // undefined if deleted
    console.log(`${key}: ${change?.oldValue} → ${newValue}`)
  })
})

// For nested observation (not needed for flat map):
entries.observeDeep(events => { /* ... */ })
```

### IndexedDB Persistence
```typescript
// Source: y-indexeddb docs
import { IndexeddbPersistence } from 'y-indexeddb'

// Use puzzle ID in name to separate puzzles
const persistence = new IndexeddbPersistence(`puzzle-${puzzleId}`, ydoc)

persistence.on('synced', () => {
  // Document loaded from IndexedDB
  // Safe to read entries now
})

// When loading new puzzle, clear old data:
await persistence.clearData()
// Then create new persistence with new puzzleId
```

### Sync Protocol (Preview for Phase 5)
```typescript
// Source: Yjs docs
// When peer connects, exchange state
const localState = Y.encodeStateAsUpdate(ydoc)
// Send to peer...

// When receiving update from peer
Y.applyUpdate(ydoc, receivedUpdate)

// Order doesn't matter—Yjs handles it
// Partial updates are fine—Yjs merges correctly
```

### React Hook Pattern
```typescript
// Source: Community pattern, verified against Yjs docs
import { useState, useEffect, useCallback, useMemo } from 'react'
import * as Y from 'yjs'

// Singleton Y.Doc (or from context)
const ydoc = new Y.Doc()

export function usePuzzleEntries() {
  const ymap = useMemo(() => ydoc.getMap<string>('entries'), [])
  const [entries, setEntries] = useState<Map<string, string>>(() =>
    new Map(ymap.entries())
  )

  useEffect(() => {
    const observer = () => {
      setEntries(new Map(ymap.entries()))
    }
    ymap.observe(observer)
    return () => ymap.unobserve(observer)
  }, [ymap])

  const setEntry = useCallback((row: number, col: number, value: string) => {
    ymap.set(`${row},${col}`, value)
  }, [ymap])

  const clearEntry = useCallback((row: number, col: number) => {
    ymap.delete(`${row},${col}`)
  }, [ymap])

  const getEntry = useCallback((row: number, col: number): string | undefined => {
    return entries.get(`${row},${col}`)
  }, [entries])

  return { entries, setEntry, clearEntry, getEntry }
}
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Automerge | Yjs | 2020+ | Yjs faster, lower memory, better ecosystem |
| Custom sync | Yjs providers | Always | Don't reinvent—y-webrtc, y-websocket work |
| localStorage persistence | y-indexeddb | Always | IndexedDB handles large docs, concurrent tabs |
| Manual undo | Y.UndoManager | Yjs 13+ | Integrated with CRDT operations |

**New tools/patterns to consider:**
- **Loro:** Newer CRDT library (Rust/WASM), potentially faster but less mature ecosystem—stick with Yjs for now
- **y-partykit:** Server provider for PartyKit infrastructure—alternative to y-websocket if using PartyKit
- **zustand-middleware-yjs:** Clean Zustand integration—evaluate if better than manual hooks

**Deprecated/outdated:**
- **Automerge (pre-2.0):** Memory issues, slower performance—Yjs is preferred
- **Custom CRDT implementations:** Yjs is battle-tested, no reason to DIY
- **Polling-based sync:** CRDTs use push-based updates via observers
</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **Zustand middleware vs custom hooks**
   - What we know: Both approaches work; middleware is cleaner but adds dependency
   - What's unclear: Whether middleware handles all crossword use cases (selective sync, reset)
   - Recommendation: Start with custom hooks (Pattern 2 Option B), refactor to middleware if it fits

2. **Document lifecycle when switching puzzles**
   - What we know: Need to clear IndexedDB and create fresh Y.Doc
   - What's unclear: Best pattern for destroying old Y.Doc cleanly
   - Recommendation: Destroy old persistence, create new Y.Doc per puzzle (not reuse)

3. **Undo/redo scope**
   - What we know: Y.UndoManager exists and tracks CRDT operations
   - What's unclear: Should undo be per-user or shared? How to scope to "my changes only"
   - Recommendation: Defer to implementation—test both approaches
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [Yjs GitHub](https://github.com/yjs/yjs) - v13.6.29, API reference, architecture
- [Yjs Docs](https://docs.yjs.dev) - Getting started, shared types, awareness
- [y-indexeddb GitHub](https://github.com/yjs/y-indexeddb) - v9.0.12, persistence API
- [y-webrtc GitHub](https://github.com/yjs/y-webrtc) - v10.3.0, P2P provider (Phase 5)
- [Y.Map Docs](https://docs.yjs.dev/api/shared-types/y.map) - Complete Y.Map API

### Secondary (MEDIUM confidence)
- [Velt CRDT Libraries Guide](https://velt.dev/blog/best-crdt-libraries-real-time-data-sync) - Yjs vs Automerge comparison
- [Tag1 Yjs Series](https://www.tag1.com/blog/offline-documents-y-indexeddb-and-web-workers-part-3/) - IndexedDB best practices
- [zustand-middleware-yjs](https://github.com/joebobmiles/zustand-middleware-yjs) - React integration pattern
- [Learn Yjs by Jamsocket](https://learn.yjs.dev/) - Interactive tutorials, pitfalls

### Tertiary (LOW confidence - needs validation)
- None—all findings verified against official docs
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Yjs CRDT framework
- Ecosystem: y-indexeddb, y-webrtc, zustand-middleware-yjs, awareness protocol
- Patterns: Flat Y.Map for grid, React decoupling, persistence lifecycle
- Pitfalls: Async persistence, duplicate docs, observer cleanup, state mixing

**Confidence breakdown:**
- Standard stack: HIGH - Official Yjs docs, GitHub verified
- Architecture: HIGH - Patterns from Yjs docs and production examples
- Pitfalls: HIGH - From Yjs community discussions and official docs
- Code examples: HIGH - Verified against Yjs API documentation

**Research date:** 2026-01-11
**Valid until:** 2026-02-11 (30 days—Yjs ecosystem is stable)
</metadata>

---

*Phase: 04-crdt-state*
*Research completed: 2026-01-11*
*Ready for planning: yes*
