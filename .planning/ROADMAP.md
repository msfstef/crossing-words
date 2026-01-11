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
- [ ] **Phase 4: CRDT State** - Conflict-free state management with Yjs/Automerge
- [ ] **Phase 5: P2P Networking** - WebRTC connections, signaling, TURN fallback
- [ ] **Phase 6: Collaboration** - Presence, session sharing, timeline system
- [ ] **Phase 7: Check/Reveal** - Verification at letter/word/puzzle level
- [ ] **Phase 8: Polish & PWA** - Mobile keyboard, themes, offline, installability

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

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/1 | Complete | 2026-01-11 |
| 2. Puzzle Core | 3/3 | Complete | 2026-01-11 |
| 3. Puzzle Import | 2/2 | Complete | 2026-01-11 |
| 4. CRDT State | 0/TBD | Not started | - |
| 5. P2P Networking | 0/TBD | Not started | - |
| 6. Collaboration | 0/TBD | Not started | - |
| 7. Check/Reveal | 0/TBD | Not started | - |
| 8. Polish & PWA | 0/TBD | Not started | - |
