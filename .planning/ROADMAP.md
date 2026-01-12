# Roadmap: Crossing Words

## Overview

Build a peer-to-peer collaborative crossword PWA from the ground up: establish the foundation, implement single-player puzzle solving, add real-time multiplayer sync via CRDTs and WebRTC, then polish with mobile UX and offline support. Each phase delivers a working increment toward the vision of "Google Docs for crosswords."

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Foundation** - PWA setup, project structure, build tooling
- [x] **Phase 2: Puzzle Core** - Grid rendering, keyboard navigation, clue display
- [x] **Phase 3: Puzzle Import** - Support for .puz, .ipuz, .jpz formats
- [x] **Phase 3.1: Puzzle Downloader** - Automatic downloader from remote sources with picker for source and day (INSERTED)
- [x] **Phase 4: CRDT State** - Conflict-free state management with Yjs/Automerge
- [x] **Phase 5: P2P Networking** - WebRTC connections, signaling, TURN fallback
- [x] **Phase 6: Collaboration** - Presence, session sharing, timeline system
- [x] **Phase 6.1: Cloudflare Worker Signaling** - Production signaling server (INSERTED)
- [x] **Phase 7: Check/Reveal** - Verification at letter/word/puzzle level
- [x] **Phase 8: Polish & PWA** - Mobile keyboard, themes, offline, installability
- [x] **Phase 9: UI Refinements** - UI refinements, details, polish
- [x] **Phase 10: Gameplay Flow Improvements** - Fixed cell sizing, cursor sharing, auto-timeline on puzzle open

## Phase Details

### Phase 1: Foundation
**Goal**: Establish PWA project structure with TypeScript, Vite, and basic shell
**Depends on**: Nothing (first phase)
**Research**: Unlikely (standard PWA setup patterns)
**Plans**: TBD

### Phase 2: Puzzle Core
**Goal**: Render crossword grid, handle keyboard navigation, display clues
**Depends on**: Phase 1
**Research**: Unlikely (internal UI patterns)
**Plans**: TBD

### Phase 3: Puzzle Import
**Goal**: Parse and load crossword files in .puz, .ipuz, and .jpz formats
**Depends on**: Phase 2
**Research**: Likely (external file format specifications)
**Research topics**: .puz binary format spec, .ipuz JSON schema, .jpz XML structure, existing JS parser libraries
**Plans**: TBD

### Phase 3.1: Puzzle Downloader (INSERTED)
**Goal**: Automatic downloader from remote sources with picker for source and day
**Depends on**: Phase 3
**Research**: Likely (external puzzle source APIs/formats)
**Research topics**: NYT crossword API, LA Times puzzle URLs, Universal crossword sources, date-based puzzle URLs, CORS handling
**Plans**: TBD

### Phase 4: CRDT State
**Goal**: Implement conflict-free puzzle state using CRDTs for multiplayer sync
**Depends on**: Phase 2
**Research**: Likely (architectural decision + library choice)
**Research topics**: Yjs vs Automerge comparison, CRDT schema design for crossword state, checked-entries-win conflict strategy
**Plans**: TBD

### Phase 5: P2P Networking
**Goal**: Establish WebRTC peer connections with signaling and TURN fallback
**Depends on**: Phase 4
**Research**: Likely (external APIs/services)
**Research topics**: WebRTC API patterns, signaling server implementation (Cloudflare Workers), public TURN servers (Google), connection lifecycle
**Plans**: TBD

### Phase 6: Collaboration
**Goal**: Add presence indicators, session sharing via link/QR, timeline system
**Depends on**: Phase 5
**Research**: Unlikely (builds on established patterns from phases 4-5)
**Plans**: TBD

### Phase 6.1: Cloudflare Worker Signaling (INSERTED)
**Goal**: Replace local signaling server with Cloudflare Worker for production P2P connections
**Depends on**: Phase 6
**Research**: Likely (WebSocket Durable Objects, existing proxy worker reuse)
**Research topics**: Cloudflare Durable Objects for WebSocket, reusing existing CORS proxy worker, signaling protocol implementation
**Plans**: TBD

### Phase 7: Check/Reveal
**Goal**: Implement verification at letter, word, and puzzle levels with auto-check option
**Depends on**: Phase 4
**Research**: Unlikely (internal application logic)
**Plans**: TBD

### Phase 8: Polish & PWA
**Goal**: Custom mobile keyboard, dark/light mode, offline support, PWA installability
**Depends on**: Phase 6, Phase 7
**Research**: Unlikely (standard PWA and mobile UX patterns)
**Plans**: TBD

### Phase 9: UI Refinements
**Goal**: UI refinements, details, polish
**Depends on**: Phase 8
**Research**: Unlikely (internal UI polish)
**Plans**: TBD

### Phase 10: Gameplay Flow Improvements
**Goal**: Fix cell sizing for all puzzle sizes, share cursor position in collaboration, auto-generate timeline on puzzle open
**Depends on**: Phase 9
**Research**: Unlikely (internal improvements)
**Plans**: TBD

**Scope:**
1. **Fixed cell sizing** - Cells should be fixed size, letters scale to fit, clue numbers smaller and behind letter, verified mark behind letter
2. **Cursor sharing** - Share focused cell position (not just highlighted word), ensure unique colors per collaborator
3. **Auto-timeline** - Generate and store timeline when opening puzzle, auto-rejoin on return, store received timeline when joining via link

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 3.1 → 4 → 5 → 6 → 6.1 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/1 | Complete | 2026-01-11 |
| 2. Puzzle Core | 3/3 | Complete | 2026-01-11 |
| 3. Puzzle Import | 2/2 | Complete | 2026-01-11 |
| 3.1 Puzzle Downloader | 2/2 | Complete | 2026-01-11 |
| 4. CRDT State | 2/2 | Complete | 2026-01-11 |
| 5. P2P Networking | 2/2 | Complete | 2026-01-11 |
| 6. Collaboration | 4/4 | Complete | 2026-01-11 |
| 6.1 CF Worker Signaling | 1/1 | Complete | 2026-01-12 |
| 7. Check/Reveal | 3/3 | Complete | 2026-01-12 |
| 8. Polish & PWA | 5/5 | Complete | 2026-01-12 |
| 9. UI Refinements | 5/5 | Complete | 2026-01-12 |
| 10. Gameplay Flow | 3/3 | Complete | 2026-01-12 |
