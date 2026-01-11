# Crossing Words

## What This Is

A cross-platform, peer-to-peer collaborative crossword app where multiple people can solve puzzles together in real-time on their own devices. Built as a PWA with WebRTC for direct device-to-device sync and CRDTs for seamless conflict resolution.

## Core Value

Seamless real-time sync — the instant collaboration experience must feel magical, like Google Docs for crosswords.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Real-time collaborative solving with instant keystroke sync across unlimited participants
- [ ] Presence indicators showing each collaborator's position via colored highlights
- [ ] Puzzle import supporting multiple formats (.puz, .ipuz, .jpz, etc.)
- [ ] Built-in puzzle browser for major newspapers (NYT, Guardian, LA Times, etc.)
- [ ] Session sharing via link/QR code generation
- [ ] Timeline system: auto-assigned puzzle/timeline IDs, explicit fork option (hidden in submenu), merge-or-join choice when timelines collide
- [ ] Check/reveal functionality at letter, word, or puzzle level
- [ ] Auto-check mode option
- [ ] CRDT-based conflict resolution where checked/verified entries take priority
- [ ] P2P architecture with WebRTC, signaling server (Cloudflare worker), and public TURN fallback
- [ ] Offline-capable with browser storage (IndexedDB/localStorage)
- [ ] Custom crossword keyboard for mobile input
- [ ] Dark/light mode following system preference
- [ ] PWA installable on mobile devices

### Out of Scope

- User accounts/authentication — no login needed, identity-free design
- Puzzle creation tools — import and browse only, no constructor
- History/stats tracking — no solve times, streaks, or past puzzle records
- Pencil mode — deferred to v2

## Context

The user regularly solves crosswords with their partner but currently shares a single phone, making collaboration awkward. Describing clues and available letters is difficult when you can't both see and interact with the puzzle.

The app should feel like you're both looking at the same puzzle on separate devices. When one person types, the other sees it instantly. Each person's selected clue is visible to others. If someone needs to step away, progress is preserved and they can rejoin seamlessly.

The timeline concept handles the case where someone wants to work on a puzzle independently before or after collaborating. If you've already started a puzzle solo and join someone else's session for the same puzzle, you get a choice: merge your timelines (with conflict UI) or keep them separate.

For puzzle sources, major newspapers and daily puzzles are the priority, but implementation must work around licensing since this is a non-commercial open project.

## Constraints

- **Platform**: PWA-first — web app that's installable on iOS/Android, not native apps
- **Infrastructure**: Minimal server footprint — signaling only (Cloudflare worker or public service), data flows P2P, public TURN servers (e.g., Google's) for relay fallback
- **Licensing**: Non-commercial project, puzzle fetching must respect or work around publisher licensing
- **Sync model**: Instant sync (every keystroke), not batched/eventual

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PWA over native apps | Simpler development, single codebase, meets cross-platform requirement | — Pending |
| CRDTs for state sync | Enables true P2P without authoritative server, handles offline/reconnection naturally | — Pending |
| Checked entries win conflicts | Clear resolution rule that rewards verification, prevents losing confirmed work | — Pending |
| Custom mobile keyboard | Better crossword UX than fighting with system keyboard focus | — Pending |
| Signaling-only server | Minimizes infrastructure cost/complexity, keeps data P2P | — Pending |

---
*Last updated: 2026-01-11 after initialization*
