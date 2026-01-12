# Phase 7: Check/Reveal - Context

**Gathered:** 2026-01-12
**Status:** Ready for planning

<vision>
## How This Should Work

Two modes of verification working together:

**On-demand checking** — Toolbar buttons let you check or reveal at three granularities: the current letter, the current word, or the entire puzzle. You decide when to use them.

**Live auto-check mode** — An optional toggle that highlights errors as you type, like a spell-checker. For when you want continuous feedback without manually checking.

When you check and something's wrong, it gets a red highlight that stays until you fix it. Clear feedback, but you're not forced to re-enter immediately.

When a cell is verified (either checked-correct or revealed), it becomes locked — you can't delete it, and typing skips over it. These cells become part of the puzzle structure, protected progress that can't be accidentally undone.

</vision>

<essential>
## What Must Be Nailed

- **Collaborative sync** — When anyone checks or reveals, that state syncs to all players via CRDT. The multiplayer experience stays consistent — everyone sees the same verified cells, the same error highlights.

- **Verified cell behavior** — Locked cells that can't be deleted and are skipped during typing. This is the core UX that makes check/reveal feel integrated, not tacked on.

</essential>

<boundaries>
## What's Out of Scope

- No scoring or statistics — not tracking hints used, time penalties, or "puzzle purity"
- No permissions or restrictions — anyone in the session can check/reveal, no host-only controls
- No undo reveal — once a letter is revealed, it's permanent

</boundaries>

<specifics>
## Specific Ideas

- Toolbar buttons for Check/Reveal actions (consistent with existing header UI)
- Three granularities: letter, word, puzzle
- Red highlight for incorrect cells (persists until corrected)
- Subtle visual indicator for verified cells (small checkmark, dot, or slight background tint)
- Auto-check toggle somewhere accessible

</specifics>

<notes>
## Additional Context

The "verified cells are immutable" concept is key to the UX — it transforms check/reveal from a hint system into a progress-locking mechanism. Verified letters feel solid and trustworthy.

This syncs naturally with the collaborative vision: when someone reveals a tricky crossing, that answer is now locked in for everyone, building shared progress.

</notes>

---

*Phase: 07-check-reveal*
*Context gathered: 2026-01-12*
