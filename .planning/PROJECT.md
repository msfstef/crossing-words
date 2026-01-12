# Crossing Words

## What This Is

A cross-platform, peer-to-peer collaborative crossword PWA where multiple people can solve puzzles together in real-time on their own devices. Built with React + TypeScript, Yjs CRDTs for conflict-free sync, WebRTC for direct device-to-device communication, and a Cloudflare Worker for signaling.

## Core Value

Seamless real-time sync — the instant collaboration experience must feel magical, like Google Docs for crosswords.

## Requirements

### Validated

- Real-time collaborative solving with instant keystroke sync across unlimited participants — v1.0
- Presence indicators showing each collaborator's position via colored highlights — v1.0
- Cursor position sharing (focused cell, not just highlighted word) — v1.0
- Puzzle import supporting multiple formats (.puz, .ipuz, .jpz) — v1.0
- Built-in puzzle browser for major newspapers (NYT, LA Times, USA Today, Universal, Newsday, WSJ) — v1.0
- Session sharing via link generation with copy and native share — v1.0
- Timeline system: auto-generated on puzzle open, auto-rejoin on return, merge-or-join on collision — v1.0
- Check/reveal functionality at letter, word, or puzzle level — v1.0
- Auto-check mode option (synced across collaborators) — v1.0
- CRDT-based conflict resolution where checked/verified entries take priority — v1.0
- P2P architecture with WebRTC via y-webrtc provider — v1.0
- Cloudflare Worker signaling server with Durable Objects — v1.0
- Offline-capable with IndexedDB persistence (Yjs + puzzle metadata) — v1.0
- Custom crossword keyboard for mobile input (react-simple-keyboard) — v1.0
- Dark/light mode with system preference detection and manual toggle — v1.0
- PWA installable on mobile devices with service worker — v1.0

### Active

(None — v1.0 MVP complete)

### Out of Scope

- User accounts/authentication — no login needed, identity-free design
- Puzzle creation tools — import and browse only, no constructor
- History/stats tracking — no solve times, streaks, or past puzzle records
- Pencil mode — deferred to v2
- Timer — deferred to v2
- Native mobile apps — PWA works well, native deferred

## Context

**Current State (v1.0):**
- 69 source files, 9,869 lines of TypeScript/CSS
- Tech stack: Vite, React 18, TypeScript, Yjs, y-webrtc, react-simple-keyboard, Workbox
- Deployed signaling: Cloudflare Worker with Durable Objects
- CORS proxy: Cloudflare Worker for puzzle downloads

The user regularly solves crosswords with their partner and can now do so collaboratively on separate devices with instant sync. Progress is preserved in IndexedDB, sessions can be shared via URL, and the timeline system handles the case where someone wants to work independently before or after collaborating.

## Constraints

- **Platform**: PWA-first — web app that's installable on iOS/Android, not native apps
- **Infrastructure**: Minimal server footprint — signaling only (Cloudflare Worker), data flows P2P, no TURN server (relies on WebRTC direct connections)
- **Licensing**: Non-commercial project, puzzle fetching via CORS proxy respects publisher access patterns
- **Sync model**: Instant sync (every keystroke), not batched/eventual

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PWA over native apps | Simpler development, single codebase, meets cross-platform requirement | Good |
| Yjs for CRDTs | Mature library, y-webrtc integration, IndexedDB persistence built-in | Good |
| Flat Y.Map with 'row,col' keys | Matches userEntries pattern, efficient lookup | Good |
| y-webrtc for P2P | Handles signaling, ICE, awareness, reconnection | Good |
| Cloudflare Durable Objects | Free tier, WebSocket hibernation, global edge | Good |
| react-simple-keyboard | Mature, customizable, touch-optimized | Good |
| useSyncExternalStore pattern | React 18 compatible, avoids ref-in-render issues | Good |
| CSS Grid + flexbox layout | Responsive, handles mobile browser chrome with 100dvh | Good |
| Timeline auto-generated on open | Every session P2P-ready instantly, enables auto-rejoin | Good |
| ResizeObserver for cell sizing | CSS clamp can't factor puzzle dimensions dynamically | Good |

---
*Last updated: 2026-01-12 after v1.0 milestone*
