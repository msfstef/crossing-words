# Phase 5: P2P Networking - Research

**Researched:** 2026-01-11
**Domain:** WebRTC peer-to-peer networking with Yjs CRDT sync
**Confidence:** HIGH

<research_summary>
## Summary

Researched the WebRTC ecosystem for P2P CRDT synchronization in a collaborative crossword application. The standard approach is to use **y-webrtc** as the Yjs provider, which handles peer discovery, WebRTC connection establishment, and document synchronization automatically.

Key finding: Don't hand-roll WebRTC peer management or signaling. y-webrtc provides a complete solution that integrates directly with existing Y.Doc instances. For custom signaling (Cloudflare Workers), two approaches exist: (1) adapt y-webrtc's built-in signaling server to run on Durable Objects, or (2) use P2PCF for serverless signaling via R2.

NAT traversal is critical: ~75% of connections work with STUN alone, but ~20-30% require TURN relay for restrictive networks/mobile. Use Open Relay's free TURN service or Cloudflare's TURN.

**Primary recommendation:** Use y-webrtc with custom signaling on Cloudflare Durable Objects + WebSocket Hibernation API. Configure STUN/TURN via `peerOpts.config.iceServers`. The existing PuzzleStore.doc is ready for provider attachment.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| y-webrtc | 10.2.6 | WebRTC provider for Yjs | Official Yjs WebRTC integration, handles peer discovery, connection, sync |
| simple-peer | 9.11.1 | WebRTC wrapper | Underlying library y-webrtc uses, proven & battle-tested |
| yjs | 13.x | CRDT (already installed) | Already in use from Phase 4 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| y-indexeddb | 9.x | Offline persistence | Already in use from Phase 4 |
| hono | 4.x | Cloudflare Workers framework | If building custom signaling server |

### Signaling Options
| Option | Pros | Cons | When to Use |
|--------|------|------|-------------|
| y-webrtc default servers | Zero setup | Shared/public, may go down | Development/testing |
| Cloudflare Durable Objects | Low cost, reliable, WebSocket hibernation | Requires deployment | Production |
| P2PCF | Serverless, R2-based | HTTP polling, not WebSocket | Alternative if avoiding WebSockets |

### STUN/TURN Options
| Service | Free Tier | Notes |
|---------|-----------|-------|
| Google STUN | Unlimited | stun:stun.l.google.com:19302 (STUN only, no TURN) |
| Open Relay (Metered) | 20GB/month TURN | staticauth.openrelay.metered.ca, reliable |
| Cloudflare TURN | Free with SFU, $0.05/GB standalone | Part of Realtime platform |
| ExpressTURN | Free tier available | expressturn.com |

**Installation:**
```bash
npm install y-webrtc
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
src/
├── crdt/
│   ├── puzzleDoc.ts       # Y.Doc creation (exists)
│   ├── puzzleStore.ts     # Store with IndexedDB (exists)
│   └── webrtcProvider.ts  # NEW: y-webrtc provider wrapper
├── services/
│   └── signaling/         # Optional: custom signaling logic
└── hooks/
    └── useCrdtPuzzle.ts   # Already integrates store (exists)
```

### Pattern 1: Attaching y-webrtc to Existing Y.Doc
**What:** Create WebrtcProvider and attach to the PuzzleStore's doc
**When to use:** When enabling P2P sync for a puzzle session
**Example:**
```typescript
// Source: y-webrtc README
import { WebrtcProvider } from 'y-webrtc';
import { PuzzleStore } from './puzzleStore';

function createP2PSession(store: PuzzleStore, roomId: string): WebrtcProvider {
  // Attach WebRTC provider to existing Y.Doc
  const provider = new WebrtcProvider(roomId, store.doc, {
    // Use custom signaling server
    signaling: ['wss://your-signaling.workers.dev'],
    // Optional: encrypt signaling communication
    password: 'optional-room-password',
    // Configure ICE servers for NAT traversal
    peerOpts: {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          {
            urls: 'turn:staticauth.openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      }
    }
  });

  return provider;
}
```

### Pattern 2: Cloudflare Durable Objects Signaling
**What:** Deploy y-webrtc-compatible signaling on Cloudflare Workers with Durable Objects
**When to use:** Production deployment needing reliable, scalable signaling
**Example:**
```typescript
// Cloudflare Worker entry point
import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

app.get('/signaling/:room', async (c) => {
  const roomId = c.req.param('room');
  // Route to Durable Object by room ID
  const id = c.env.SIGNALING_ROOM.idFromName(roomId);
  const stub = c.env.SIGNALING_ROOM.get(id);
  return stub.fetch(c.req.raw);
});

export default app;

// Durable Object class
export class SignalingRoom {
  state: DurableObjectState;
  connections: Map<string, WebSocket> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    // Handle WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Use hibernation API for cost efficiency
    this.state.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    // Broadcast to all other connections in room
    for (const conn of this.state.getWebSockets()) {
      if (conn !== ws) {
        conn.send(message);
      }
    }
  }
}
```

### Pattern 3: Provider Lifecycle Management
**What:** Proper creation and cleanup of WebRTC provider with store
**When to use:** Always - prevents memory leaks and stale connections
**Example:**
```typescript
// In useCrdtPuzzle.ts or similar hook
function useP2PSync(store: PuzzleStore | null, roomId: string | null) {
  const providerRef = useRef<WebrtcProvider | null>(null);

  useEffect(() => {
    if (!store || !roomId) return;

    // Create provider after store is ready
    store.ready.then(() => {
      providerRef.current = new WebrtcProvider(roomId, store.doc, {
        signaling: [SIGNALING_URL],
        peerOpts: { config: { iceServers: ICE_SERVERS } }
      });
    });

    return () => {
      // Clean up provider on unmount or dependency change
      providerRef.current?.destroy();
      providerRef.current = null;
    };
  }, [store, roomId]);

  return providerRef;
}
```

### Anti-Patterns to Avoid
- **Creating multiple providers for same doc:** One WebrtcProvider per Y.Doc per room
- **Hardcoding default signaling servers in production:** Will be unreliable
- **Skipping TURN configuration:** ~20-30% of users need it for connectivity
- **Not destroying provider on cleanup:** Memory leaks, stale connections
- **Manual peer management:** y-webrtc handles this automatically
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebRTC peer discovery | Custom signaling protocol | y-webrtc signaling | Handles offers/answers/ICE candidates correctly |
| Peer connection management | Manual RTCPeerConnection | y-webrtc/simple-peer | Edge cases, reconnection, multiple browser support |
| NAT traversal | Custom STUN/TURN logic | ICE server configuration | Extremely complex, browser handles it |
| Document sync over WebRTC | Custom data channel protocol | y-webrtc | Syncs Yjs updates automatically with awareness |
| Signaling server | From scratch WebSocket server | Durable Objects or y-webrtc bin/server.js | Battle-tested, handles room routing |
| Peer limit management | Manual connection counting | y-webrtc maxConns | Handles random distribution to prevent clustering |
| Cross-tab communication | Manual BroadcastChannel | y-webrtc filterBcConns | Automatic optimization for same-browser tabs |

**Key insight:** WebRTC is notoriously complex with many edge cases (ICE failures, browser differences, NAT types, reconnection). y-webrtc has years of real-world usage handling these issues. The integration point is simply `new WebrtcProvider(room, doc, options)` - everything else is automatic.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: No TURN Server Configuration
**What goes wrong:** Connections fail for ~20-30% of users behind symmetric NATs or restrictive firewalls
**Why it happens:** Default ICE servers only include STUN, which can't relay traffic
**How to avoid:** Always configure at least one TURN server in peerOpts.config.iceServers
**Warning signs:** Works on local network but fails for remote users, especially mobile

### Pitfall 2: Relying on Public Signaling Servers in Production
**What goes wrong:** y-webrtc default servers (signaling.yjs.dev) may be down or rate-limited
**Why it happens:** They're maintained for demos, not production use
**How to avoid:** Deploy your own signaling server (Cloudflare Durable Objects is ideal)
**Warning signs:** Intermittent "unable to find peers" errors in production

### Pitfall 3: Not Waiting for IndexedDB Sync Before Provider
**What goes wrong:** Provider syncs empty state, overwrites local progress
**Why it happens:** WebRTC provider attached before IndexedDB loads existing data
**How to avoid:** Always await store.ready before creating WebrtcProvider
**Warning signs:** User's progress disappears when reconnecting to a room

### Pitfall 4: Provider Not Destroyed on Component Unmount
**What goes wrong:** Memory leaks, ghost connections, updates to unmounted components
**Why it happens:** Missing cleanup in useEffect
**How to avoid:** Always call provider.destroy() in useEffect cleanup function
**Warning signs:** Increasing memory usage, console errors about state updates after unmount

### Pitfall 5: Expecting Mesh to Scale Beyond 4-6 Peers
**What goes wrong:** Performance degrades, connections drop, sync becomes unreliable
**Why it happens:** WebRTC mesh grows as n*(n-1) connections, y-webrtc limits to 20-35 peers
**How to avoid:** For >6 active collaborators, consider SFU architecture (out of scope for Phase 5)
**Warning signs:** Lag increases with each new peer, some peers don't see updates

### Pitfall 6: One-Directional Sync After Reconnection
**What goes wrong:** After disconnect/reconnect, updates only flow one direction
**Why it happens:** Known y-webrtc issue with reconnection handling
**How to avoid:** Monitor connection state, consider destroying and recreating provider on reconnect
**Warning signs:** Peer A sees Peer B's changes, but Peer B doesn't see Peer A's changes
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources:

### Basic y-webrtc Setup
```typescript
// Source: y-webrtc README
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

const ydoc = new Y.Doc();
const provider = new WebrtcProvider('room-name', ydoc, {
  password: 'optional-encryption-password'
});

// Access awareness for presence (Phase 6)
const awareness = provider.awareness;
awareness.setLocalState({ user: { name: 'User 1' } });

// Cleanup
provider.destroy();
```

### Production ICE Server Configuration
```typescript
// Source: simple-peer docs + Open Relay
const ICE_SERVERS: RTCIceServer[] = [
  // STUN servers (free, unlimited)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  // TURN server (Open Relay free tier - 20GB/month)
  {
    urls: [
      'turn:staticauth.openrelay.metered.ca:80',
      'turn:staticauth.openrelay.metered.ca:443',
      'turns:staticauth.openrelay.metered.ca:443'
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

const provider = new WebrtcProvider('room-name', ydoc, {
  peerOpts: {
    config: { iceServers: ICE_SERVERS }
  }
});
```

### Integration with Existing PuzzleStore
```typescript
// Integration pattern for Crossing Words
import { WebrtcProvider } from 'y-webrtc';
import { PuzzleStore } from '../crdt/puzzleStore';

interface P2PSession {
  provider: WebrtcProvider;
  destroy: () => void;
}

export async function createP2PSession(
  store: PuzzleStore,
  roomId: string,
  signalingUrls: string[]
): Promise<P2PSession> {
  // Wait for IndexedDB to sync first
  await store.ready;

  const provider = new WebrtcProvider(roomId, store.doc, {
    signaling: signalingUrls,
    peerOpts: {
      config: { iceServers: ICE_SERVERS }
    }
  });

  return {
    provider,
    destroy: () => {
      provider.destroy();
    }
  };
}
```

### Monitoring Connection State
```typescript
// Source: y-webrtc API
provider.on('status', (event: { connected: boolean }) => {
  console.log('WebRTC connected:', event.connected);
});

// For debugging - enable logging
if (import.meta.env.DEV) {
  localStorage.log = 'y-webrtc';
}
```

### Cloudflare Durable Object Signaling (wrangler.toml)
```toml
name = "crossing-words-signaling"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[durable_objects.bindings]]
name = "SIGNALING_ROOM"
class_name = "SignalingRoom"

[[migrations]]
tag = "v1"
new_classes = ["SignalingRoom"]
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Heroku signaling servers | Cloudflare Durable Objects | 2023+ | Free tier, hibernation reduces costs to ~$0 |
| Manual RTCPeerConnection | y-webrtc + simple-peer | Stable | Don't build WebRTC from scratch |
| No TURN (STUN only) | Always include TURN | Ongoing | Critical for 20-30% of users |
| HTTP polling signaling | WebSocket + Hibernation API | 2024 | Reduced latency, lower costs |

**New tools/patterns to consider:**
- **Cloudflare Durable Objects Hibernation API:** WebSocket connections maintained for free, only pay for message processing. Ideal for signaling.
- **P2PCF:** Alternative signaling using R2 + HTTP polling if avoiding WebSockets.
- **Cloudflare Realtime TURN:** $0.05/GB but free when used with their SFU.

**Deprecated/outdated:**
- **y-webrtc-signaling-eu/us.herokuapp.com:** Heroku ended free tier, these may be unreliable
- **Manual ICE candidate trickle:** simple-peer handles this, don't implement manually
- **Custom sync protocols over DataChannel:** Use y-webrtc, it syncs Yjs automatically
</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **y-webrtc reconnection bug severity**
   - What we know: There's a known issue where updates become one-directional after reconnect
   - What's unclear: How often this occurs in practice, whether it's fixed in 10.2.6
   - Recommendation: Monitor in testing, prepare workaround (destroy/recreate provider on reconnect)

2. **Optimal TURN provider for production**
   - What we know: Open Relay offers 20GB/month free, Cloudflare TURN is $0.05/GB
   - What's unclear: Open Relay reliability under load, credential rotation
   - Recommendation: Start with Open Relay, monitor usage, evaluate Cloudflare if issues arise

3. **Signaling server compatibility with y-webrtc**
   - What we know: y-webrtc expects specific WebSocket message format
   - What's unclear: Exact protocol details for custom signaling server
   - Recommendation: Study y-webrtc bin/server.js source, or use P2PCF as alternative
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [y-webrtc GitHub](https://github.com/yjs/y-webrtc) - API, configuration, signaling server
- [y-webrtc npm](https://www.npmjs.com/package/y-webrtc) - Version info, install
- [simple-peer GitHub](https://github.com/feross/simple-peer) - ICE server configuration
- [Open Relay Project](https://www.metered.ca/tools/openrelay/) - Free TURN server details
- [Cloudflare Durable Objects WebSocket docs](https://developers.cloudflare.com/durable-objects/best-practices/websockets/) - Signaling architecture

### Secondary (MEDIUM confidence)
- [P2PCF GitHub](https://github.com/gfodor/p2pcf) - Alternative Cloudflare signaling approach
- [Cloudflare TURN docs](https://developers.cloudflare.com/realtime/turn/) - Managed TURN service
- [WebRTC NAT traversal statistics](https://bloggeek.me/webrtc-turn/) - STUN vs TURN success rates
- [y-webrtc Yjs Community discussion](https://discuss.yjs.dev/) - Reconnection issues

### Tertiary (LOW confidence - needs validation)
- WebRTC mesh scalability limits (~4-6 peers) - general industry knowledge, verify in testing
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: WebRTC via y-webrtc provider
- Ecosystem: Signaling (Cloudflare Durable Objects), ICE servers (STUN/TURN)
- Patterns: Provider lifecycle, ICE configuration, signaling architecture
- Pitfalls: TURN missing, public signaling, reconnection, mesh limits

**Confidence breakdown:**
- Standard stack: HIGH - y-webrtc is official Yjs WebRTC provider
- Architecture: HIGH - well-documented patterns, verified with existing PuzzleStore code
- Pitfalls: HIGH - documented in GitHub issues and community forums
- Code examples: HIGH - from official y-webrtc and simple-peer documentation

**Research date:** 2026-01-11
**Valid until:** 2026-02-11 (30 days - WebRTC/Yjs ecosystem stable)
</metadata>

---

*Phase: 05-p2p-networking*
*Research completed: 2026-01-11*
*Ready for planning: yes*
