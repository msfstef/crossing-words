# Roadmap: Crossing Words

## Milestones

- [v1.0 MVP](milestones/v1.0-ROADMAP.md) (Phases 1-10) — SHIPPED 2026-01-12

## Overview

Build a peer-to-peer collaborative crossword PWA from the ground up: establish the foundation, implement single-player puzzle solving, add real-time multiplayer sync via CRDTs and WebRTC, then polish with mobile UX and offline support. Each phase delivers a working increment toward the vision of "Google Docs for crosswords."

## Completed Milestones

<details>
<summary>v1.0 MVP (Phases 1-10) — SHIPPED 2026-01-12</summary>

- [x] **Phase 1: Foundation** - PWA setup, project structure, build tooling
- [x] **Phase 2: Puzzle Core** - Grid rendering, keyboard navigation, clue display
- [x] **Phase 3: Puzzle Import** - Support for .puz, .ipuz, .jpz formats
- [x] **Phase 3.1: Puzzle Downloader** - Automatic downloader from remote sources (INSERTED)
- [x] **Phase 4: CRDT State** - Conflict-free state management with Yjs
- [x] **Phase 5: P2P Networking** - WebRTC connections, signaling, TURN fallback
- [x] **Phase 6: Collaboration** - Presence, session sharing, timeline system
- [x] **Phase 6.1: Cloudflare Worker Signaling** - Production signaling server (INSERTED)
- [x] **Phase 7: Check/Reveal** - Verification at letter/word/puzzle level
- [x] **Phase 8: Polish & PWA** - Mobile keyboard, themes, offline, installability
- [x] **Phase 9: UI Refinements** - UI refinements, details, polish
- [x] **Phase 10: Gameplay Flow** - Fixed cell sizing, cursor sharing, auto-timeline

**Stats:** 12 phases, 37 plans, 69 files, 9,869 LOC TypeScript/CSS

See [v1.0 archive](milestones/v1.0-ROADMAP.md) for full details.

</details>

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 3.1 → 4 → 5 → 6 → 6.1 → 7 → 8 → 9 → 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 1/1 | Complete | 2026-01-11 |
| 2. Puzzle Core | v1.0 | 3/3 | Complete | 2026-01-11 |
| 3. Puzzle Import | v1.0 | 2/2 | Complete | 2026-01-11 |
| 3.1 Puzzle Downloader | v1.0 | 2/2 | Complete | 2026-01-11 |
| 4. CRDT State | v1.0 | 2/2 | Complete | 2026-01-11 |
| 5. P2P Networking | v1.0 | 2/2 | Complete | 2026-01-11 |
| 6. Collaboration | v1.0 | 4/4 | Complete | 2026-01-11 |
| 6.1 CF Worker Signaling | v1.0 | 1/1 | Complete | 2026-01-12 |
| 7. Check/Reveal | v1.0 | 3/3 | Complete | 2026-01-12 |
| 8. Polish & PWA | v1.0 | 5/5 | Complete | 2026-01-12 |
| 9. UI Refinements | v1.0 | 5/5 | Complete | 2026-01-12 |
| 10. Gameplay Flow | v1.0 | 3/3 | Complete | 2026-01-12 |
