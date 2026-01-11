# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-11)

**Core value:** Seamless real-time sync — the instant collaboration experience must feel magical, like Google Docs for crosswords.
**Current focus:** Phase 4 — CRDT State (In progress)

## Current Position

Phase: 4 of 8 (CRDT State)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2026-01-11 — Completed 04-01-PLAN.md

Progress: ███████░░░ 69%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 12 min
- Total execution time: 1.71 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 1 | 10 min | 10 min |
| 2. Puzzle Core | 3 | 35 min | 12 min |
| 3. Puzzle Import | 2 | 20 min | 10 min |
| 3.1 Puzzle Downloader | 2 | 32 min | 16 min |
| 4. CRDT State | 1 | 6 min | 6 min |

**Recent Trend:**
- Last 5 plans: 4, 16, 14, 18, 6 min
- Trend: Fast plan, minimal deviation

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 01 | Dark theme (#1a1a2e) as default | Matches PWA manifest, consistent branding |
| 01 | SVG placeholder icons | Scalable, real icons deferred to Phase 8 |
| 01-FIX | Relative icon paths in manifest | Avoids path resolution issues |
| 01-FIX | Added maskable icon variants | Better PWA installability |
| 02-01 | Map<string,string> with 'row,col' key | Efficient userEntries lookup |
| 02-01 | Store solution in Cell.letter | Enables future check/reveal |
| 02-01 | CSS Grid with aspect-ratio: 1 | Square cells, responsive layout |
| 02-02 | Document-level keydown listener | Immediate keyboard input |
| 02-02 | Auto-advance stays at word end | Natural crossword behavior |
| 02-02 | Backspace dual behavior | Clear or move back based on cell state |
| 02-03 | Auto-advance skips cells without clue | Only land on cells with clue in direction |
| 02-03 | Direction toggle only if alternate valid | Prevents showing empty clue bar |
| 02-03 | Row/column wrap on advance | Natural flow when reaching end |
| 03-01 | Use xd-crossword-tools for puz/jpz | Don't hand-roll binary/XML parsing |
| 03-01 | Parse ipuz directly | Native JSON format, no library needed |
| 03-02 | Hidden file input pattern | Styled button, invisible native input |
| 03-02 | Error auto-dismiss 5s | Non-blocking UX, manual close option too |
| 03-02 | Key prop for puzzle reset | Forces usePuzzleState to reinitialize |
| 3.1-01 | Cloudflare Workers for CORS proxy | Free tier, global edge, no maintenance |
| 3.1-01 | POST /puzzle with JSON body API | Source/date separation, easy to extend |
| 3.1-01 | 10s upstream timeout | Prevent hanging requests |
| 3.1-02 | Direct-first fetch with proxy fallback | Reduces proxy load, lower latency when CORS allowed |
| 3.1-02 | herbach.dnsalias.com for Universal | Official andrewsmcmeel.com 404s, community archive reliable |
| 3.1-02 | Source registry with getDirectUrl | Per-source URL construction flexibility |
| 04-01 | Flat Y.Map with 'row,col' keys | Matches existing userEntries pattern |
| 04-01 | One Y.Doc per puzzle | Isolated persistence and clean provider attachment |
| 04-01 | Ready promise pattern | Prevents reading empty state before IndexedDB loads |

### Roadmap Evolution

- Phase 3.1 inserted after Phase 3: Automatic downloader from remote sources with picker for source and day (INSERTED)

### Deferred Issues

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-01-11
Stopped at: Completed 04-01-PLAN.md (Yjs Infrastructure)
Resume file: None
