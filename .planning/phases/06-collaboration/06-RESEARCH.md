# Phase 6: Collaboration - Research

**Researched:** 2026-01-11
**Domain:** Real-time collaborative presence, session sharing, timeline management
**Confidence:** HIGH

<research_summary>
## Summary

Researched patterns for implementing collaborative features in a Yjs-based P2P crossword app. The standard approach leverages Yjs Awareness protocol (built into y-webrtc) for presence tracking, nanoid for URL-safe room IDs, Web Share API + QR codes for session sharing, and Yjs document merge APIs for timeline collision handling.

Key finding: Don't hand-roll presence or peer discovery. Yjs Awareness is a purpose-built CRDT that handles ephemeral presence state (cursors, selections, user info) with automatic offline detection and cleanup. It's already bundled with y-webrtc via `provider.awareness`.

**Primary recommendation:** Use `provider.awareness` from existing y-webrtc setup for all presence features. Add nanoid for room ID generation, qrcode.react for QR display, and sonner for join/leave toast notifications. For timeline merge, use Yjs's built-in `Y.mergeUpdates` and `Y.applyUpdate` APIs.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| y-protocols | 1.0.6 | Awareness protocol | Official Yjs awareness implementation, bundled with y-webrtc |
| nanoid | 5.0.9 | Room ID generation | URL-safe, 21 chars, UUID-level collision resistance, 118 bytes |
| qrcode.react | 4.1.0 | QR code display | SVG/Canvas output, customizable, widely used |
| sonner | 1.7.0 | Toast notifications | Minimal (5KB), smooth animations, React 18+ optimized |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| distinct-colors | 2.3.0 | Auto-assign user colors | Generate visually distinct colors for collaborators |
| chroma-js | 2.6.0 | Color manipulation | Peer dep of distinct-colors, also useful for color operations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nanoid | uuid | UUID is 36 chars vs 21, not URL-optimized |
| qrcode.react | react-qr-code | Both work well, qrcode.react has more customization |
| sonner | react-hot-toast | Both minimal, sonner has better animations |
| distinct-colors | hand-coded palette | Library handles edge cases for 10+ users |

**Installation:**
```bash
npm install nanoid qrcode.react sonner distinct-colors
```

Note: `y-protocols` is already a dependency of `y-webrtc`, no additional install needed for awareness.
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
src/
├── collaboration/
│   ├── awareness.ts           # Awareness state types and helpers
│   ├── useCollaborators.ts    # Hook for collaborator presence
│   ├── useShareSession.ts     # Hook for sharing (link/QR)
│   └── colors.ts              # Color assignment logic
├── components/
│   ├── CollaboratorAvatars.tsx # Avatar row in header
│   ├── ShareDialog.tsx         # Link/QR share modal
│   └── CollaboratorCursors.tsx # Word highlighting overlays
└── hooks/
    └── useCrdtPuzzle.ts       # Extend with awareness integration
```

### Pattern 1: Awareness State Structure
**What:** Define a consistent shape for awareness state across collaborators
**When to use:** Any presence feature (cursors, selections, user info)
**Example:**
```typescript
// Source: Yjs docs + community patterns
interface CollaboratorState {
  user: {
    name: string;      // Auto-generated nickname
    color: string;     // Hex color (e.g., "#ff6b6b")
  };
  cursor: {
    row: number;
    col: number;
    direction: 'across' | 'down';
  } | null;
}

// Set local state
awareness.setLocalStateField('user', { name: 'Fox', color: '#ff6b6b' });
awareness.setLocalStateField('cursor', { row: 3, col: 7, direction: 'across' });

// Get all states (Map<clientId, CollaboratorState>)
const states = awareness.getStates();
```

### Pattern 2: React Integration with useSyncExternalStore
**What:** Sync Yjs Awareness with React state properly
**When to use:** Any component displaying collaborator info
**Example:**
```typescript
// Source: React 18 pattern for external stores
import { useSyncExternalStore } from 'react';

function useCollaborators(awareness: Awareness) {
  const subscribe = useCallback((callback: () => void) => {
    awareness.on('change', callback);
    return () => awareness.off('change', callback);
  }, [awareness]);

  const getSnapshot = useCallback(() => {
    // Filter out own client, return array of collaborator states
    const states = awareness.getStates();
    const localId = awareness.clientID;
    return Array.from(states.entries())
      .filter(([id]) => id !== localId)
      .map(([id, state]) => ({ id, ...state }));
  }, [awareness]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
```

### Pattern 3: Timeline ID Generation and URL Structure
**What:** Generate unique timeline IDs and embed in shareable URLs
**When to use:** Creating new collaborative sessions
**Example:**
```typescript
// Source: nanoid docs
import { nanoid } from 'nanoid';

// Generate timeline ID (21 chars, URL-safe)
const timelineId = nanoid(); // e.g., "V1StGXR8_Z5jdHi6B-myT"

// URL structure: puzzle ID in path, timeline in hash
// https://app.com/#puzzle=nyt-2026-01-11&timeline=V1StGXR8_Z5jdHi6B-myT
const shareUrl = `${window.location.origin}/#puzzle=${puzzleId}&timeline=${timelineId}`;
```

### Pattern 4: Session Sharing with Web Share API + Fallback
**What:** Native share sheet on mobile, copy to clipboard on desktop
**When to use:** Share button/dialog
**Example:**
```typescript
// Source: MDN Web Share API
async function shareSession(url: string, title: string) {
  const shareData = { title, url };

  if (navigator.canShare?.(shareData)) {
    try {
      await navigator.share(shareData);
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }

  // Fallback: copy to clipboard
  await navigator.clipboard.writeText(url);
  return 'copied';
}
```

### Pattern 5: Document Merge for Timeline Collision
**What:** Merge two Yjs documents when user has existing progress
**When to use:** Join flow when user already has a timeline for this puzzle
**Example:**
```typescript
// Source: Yjs Document Updates API
import * as Y from 'yjs';

function mergeTimelines(localDoc: Y.Doc, remoteUpdate: Uint8Array) {
  // Apply remote state to local - Yjs handles CRDT merge
  Y.applyUpdate(localDoc, remoteUpdate);
  // Both timelines are now merged, conflicts resolved by CRDT
}

// For "save as new timeline" - just create new doc with remote state
function forkTimeline(remoteUpdate: Uint8Array): Y.Doc {
  const newDoc = new Y.Doc();
  Y.applyUpdate(newDoc, remoteUpdate);
  return newDoc;
}
```

### Anti-Patterns to Avoid
- **Storing presence in Y.Doc:** Awareness is ephemeral; don't persist cursor positions
- **Manual heartbeats:** Awareness auto-broadcasts every 30s, don't duplicate
- **Polling awareness state:** Use event listeners, not setInterval
- **Creating awareness manually:** Use `provider.awareness` from y-webrtc
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Presence tracking | Custom peer-to-peer presence | Yjs Awareness protocol | Handles offline detection, state cleanup, efficient sync |
| User color assignment | Random color picker | distinct-colors library | Ensures visually distinct colors for 10+ users |
| Room ID generation | Math.random + base64 | nanoid | Cryptographically secure, URL-safe, collision-resistant |
| QR code rendering | Canvas drawing code | qrcode.react | Error correction, sizing, styling handled |
| Toast notifications | Custom toast system | sonner | Animations, accessibility, stacking handled |
| Document merging | Manual state reconciliation | Y.applyUpdate / Y.mergeUpdates | CRDT merge is complex, Yjs does it right |
| Clipboard API | execCommand('copy') | navigator.clipboard | Modern API with proper async/error handling |

**Key insight:** Collaboration features have many edge cases: offline detection timing, color collision for many users, QR error correction levels, toast animation queuing. Libraries handle these; hand-rolling means debugging obscure issues.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Ghost Cursors After Disconnect
**What goes wrong:** Collaborator cursors linger after they disconnect
**Why it happens:** Not cleaning up awareness state on provider destroy
**How to avoid:** Awareness auto-cleans after 30s timeout, but call `awareness.setLocalState(null)` on intentional leave
**Warning signs:** Stale cursors that never disappear

### Pitfall 2: Color Collision with Many Users
**What goes wrong:** Two collaborators get same/similar colors
**Why it happens:** Using small hardcoded palette or random selection
**How to avoid:** Use distinct-colors with count = max expected users + buffer
**Warning signs:** "Which cursor is mine?" confusion

### Pitfall 3: Timeline Merge Overwrites Local Progress
**What goes wrong:** User's local progress disappears when joining session
**Why it happens:** Replacing local doc instead of merging
**How to avoid:** Always use `Y.applyUpdate` for merge, never `new Y.Doc()` + full replacement
**Warning signs:** "My letters disappeared" complaints

### Pitfall 4: Awareness Updates Flood React Renders
**What goes wrong:** Performance degrades with multiple collaborators
**Why it happens:** Re-rendering on every awareness update (every 30s × N users)
**How to avoid:** Use `useSyncExternalStore` with memoized snapshots, compare by value not reference
**Warning signs:** FPS drops when >3 collaborators

### Pitfall 5: QR Code Too Dense to Scan
**What goes wrong:** QR code doesn't scan reliably on phones
**Why it happens:** URL too long, error correction too low
**How to avoid:** Keep URLs short (nanoid helps), use error correction level M or higher
**Warning signs:** Multiple scan attempts needed

### Pitfall 6: Web Share API Fails Silently
**What goes wrong:** Share button does nothing on some browsers
**Why it happens:** Web Share API requires HTTPS and user gesture, not all browsers support
**How to avoid:** Always have clipboard fallback, check `navigator.canShare()` first
**Warning signs:** Share works on mobile Safari but not desktop Chrome
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources:

### Setting Up Awareness with y-webrtc
```typescript
// Source: y-webrtc docs + Yjs awareness docs
import { WebrtcProvider } from 'y-webrtc';
import type { Awareness } from 'y-protocols/awareness';

// Awareness is automatically created by WebrtcProvider
const provider = new WebrtcProvider(roomName, ydoc, {
  signaling: ['ws://localhost:4444'],
  peerOpts: { config: { iceServers: ICE_SERVERS } }
});

// Access awareness from provider
const awareness: Awareness = provider.awareness;

// Set local user state
awareness.setLocalStateField('user', {
  name: generateNickname(), // e.g., "Clever Fox"
  color: assignColor(awareness.clientID)
});
```

### Listening to Awareness Changes
```typescript
// Source: Yjs awareness API docs
awareness.on('change', ({ added, updated, removed }) => {
  // added: clientIds of new users
  // updated: clientIds of users who changed state
  // removed: clientIds of users who left

  console.log('Collaborators changed:', { added, updated, removed });

  // Get all current states
  const states = awareness.getStates(); // Map<number, any>
});

// 'update' event fires more often (heartbeats), use 'change' for UI
```

### Generating Distinct Colors
```typescript
// Source: distinct-colors docs
import distinctColors from 'distinct-colors';

// Pre-generate palette for max expected collaborators
const palette = distinctColors({
  count: 12,
  chromaMin: 50,  // Avoid washed-out colors
  lightMin: 35,   // Avoid too dark
  lightMax: 75,   // Avoid too light
});

// Assign by client ID (stable across sessions)
function assignColor(clientId: number): string {
  const index = clientId % palette.length;
  return palette[index].hex();
}
```

### QR Code Component
```typescript
// Source: qrcode.react docs
import { QRCodeSVG } from 'qrcode.react';

function ShareQRCode({ url }: { url: string }) {
  return (
    <QRCodeSVG
      value={url}
      size={200}
      level="M"  // Medium error correction
      bgColor="#1a1a2e"  // Match app theme
      fgColor="#ffffff"
    />
  );
}
```

### Toast Notifications for Join/Leave
```typescript
// Source: sonner docs
import { toast, Toaster } from 'sonner';

// In root component
<Toaster position="bottom-center" />

// On collaborator join (in awareness change handler)
if (added.length > 0) {
  const newUser = awareness.getStates().get(added[0])?.user;
  if (newUser) {
    toast(`${newUser.name} joined`, {
      icon: '👋',
      duration: 3000,
    });
  }
}

// On collaborator leave
if (removed.length > 0) {
  toast('Someone left', { duration: 2000 });
}
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual presence polling | Yjs Awareness CRDT | 2020+ | Built-in offline detection, no custom code |
| UUID for room IDs | nanoid | 2023+ | Shorter URLs, same collision resistance |
| Custom toast implementations | sonner/react-hot-toast | 2024+ | Animation, accessibility, stacking solved |
| execCommand('copy') | navigator.clipboard | 2020+ | Async, better error handling |

**New tools/patterns to consider:**
- **Web Share API:** Native share sheets on mobile (supported iOS/Android)
- **useSyncExternalStore:** Proper React 18 pattern for Yjs integration
- **SVG QR codes:** Better than Canvas for responsive sizing

**Deprecated/outdated:**
- **Custom CRDT for presence:** Yjs Awareness exists, don't reinvent
- **Socket.io for presence:** y-webrtc handles it via signaling
- **Polling-based online detection:** Awareness heartbeats handle this
</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **Exact nickname generation approach**
   - What we know: Should be auto-generated, stored locally, adjective+noun pattern works
   - What's unclear: Best library for nickname generation (unique-names-generator, human-id, etc.)
   - Recommendation: Keep simple with hardcoded adjective+animal lists initially

2. **Ghost presence duration before removal**
   - What we know: Awareness auto-removes after 30s timeout
   - What's unclear: Whether to show "away" state visually during this period
   - Recommendation: Show dimmed avatar during disconnect grace period, full removal after timeout

3. **Max collaborators practical limit**
   - What we know: y-webrtc defaults to ~20-35 max connections per peer
   - What's unclear: At what point performance degrades noticeably
   - Recommendation: Don't artificially limit, but test with 10+ concurrent users
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [Yjs Awareness API](https://docs.yjs.dev/api/about-awareness) - Core awareness protocol documentation
- [Yjs Adding Awareness Tutorial](https://docs.yjs.dev/getting-started/adding-awareness) - Implementation patterns
- [Yjs Document Updates API](https://docs.yjs.dev/api/document-updates) - Merge/diff operations
- [y-webrtc GitHub](https://github.com/yjs/y-webrtc) - Provider awareness access pattern
- [nanoid GitHub](https://github.com/ai/nanoid) - Room ID generation, collision math
- [qrcode.react npm](https://www.npmjs.com/package/qrcode.react) - QR code component API
- [MDN Web Share API](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) - Share functionality

### Secondary (MEDIUM confidence)
- [distinct-colors GitHub](https://github.com/internalfx/distinct-colors) - Color generation API
- [sonner GitHub](https://github.com/emilkowalski/sonner) - Toast notifications
- [Building Share Systems in React](https://dev.to/miracleio/building-a-flexible-share-system-in-react-with-the-web-share-api-5fi0) - Share + clipboard pattern
- [Figma Multiplayer Blog](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/) - Presence UX inspiration

### Tertiary (LOW confidence - needs validation)
- Color assignment algorithm specifics - Not documented by Figma/Google, community patterns used
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Yjs Awareness protocol via y-webrtc
- Ecosystem: nanoid, qrcode.react, sonner, distinct-colors
- Patterns: Presence state structure, React integration, session sharing, timeline merge
- Pitfalls: Ghost cursors, color collision, merge overwrites, performance

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs/npm
- Architecture: HIGH - Patterns from Yjs official docs and community best practices
- Pitfalls: HIGH - Documented in Yjs community discussions
- Code examples: HIGH - From official docs and verified patterns

**Research date:** 2026-01-11
**Valid until:** 2026-02-11 (30 days - Yjs ecosystem stable)
</metadata>

---

*Phase: 06-collaboration*
*Research completed: 2026-01-11*
*Ready for planning: yes*
