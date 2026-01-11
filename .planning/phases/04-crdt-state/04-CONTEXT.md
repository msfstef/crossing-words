# Phase 4: CRDT State - Context

**Gathered:** 2026-01-11
**Status:** Ready for research

<vision>
## How This Should Work

Multiplayer sync should feel smooth and invisible. When two people are solving together, their changes merge gracefully without any jarring overwrites or confusing conflicts. The focus is on graceful conflict resolution — when two people type in the same cell, it just works.

The experience should feel as responsive as single-player. Typing a letter should appear instantly, not after a network round-trip. The underlying CRDT handles sync in the background without the user ever thinking about it.

</vision>

<essential>
## What Must Be Nailed

- **Rock-solid sync** — The state should never diverge or corrupt. Reliability is foundational.
- **Feels instant** — Low latency is key. Typing should be as responsive as single-player mode.
- **Offline-friendly** — Should work offline and merge cleanly when reconnecting. No lost work.

</essential>

<boundaries>
## What's Out of Scope

- Networking layer (WebRTC, signaling, TURN) — that's Phase 5
- Presence indicators (cursors, selections, who's typing) — that's Phase 6
- Session sharing UI — that's Phase 6
- Any collaboration UX beyond the data structure itself

</boundaries>

<specifics>
## Specific Ideas

- Use Yjs as the CRDT library — proven track record for collaborative apps
- Last-write-wins conflict resolution for cell values — simple and predictable
- State needs to represent: user entries per cell, potentially timestamps for LWW

</specifics>

<notes>
## Additional Context

This phase establishes the foundation that Phases 5 and 6 build upon. The CRDT structure needs to be solid because everything collaborative depends on it.

The puzzle state is relatively simple compared to text documents: a grid of cells with single-letter values. This plays to CRDTs' strengths.

</notes>

---

*Phase: 04-crdt-state*
*Context gathered: 2026-01-11*
