# Phase 6: Collaboration - Context

**Gathered:** 2026-01-11
**Status:** Ready for planning

<vision>
## How This Should Work

When someone joins your puzzle session, it should feel like Google Docs — you instantly see where they're working. The entire word/clue they're focused on highlights in their assigned color, not just a single cell. When two people work on intersecting words, the overlap is handled gracefully.

Sharing is link + QR code. Copy a link to share via any channel, or show a QR when sitting with someone so they can scan to join instantly.

**The timeline model is key:** Each puzzle has a puzzle ID, and each attempt to solve it has a timeline ID. You can have multiple separate "games" trying to solve the same puzzle. When people collaborate, they're sharing the same timeline. The person joining gets a copy of that timeline's state.

Every keystroke syncs instantly — you see letters appear the moment someone types them.

**Join flow:**
- If the person joining has an in-progress timeline for this puzzle: offer a choice to either merge (combining progress, then discarding their separate timeline) or save the shared timeline as a new one (keeping both)
- If they don't have the puzzle, or have completed it: instant drop-in, no friction
- Merge conflict resolution: checked/solved cells always win, otherwise the shared timeline's answer wins

Collaborator presence shows as an avatar row in the header — small colored circles/initials showing who's connected. When someone disconnects, they show as "away" (ghost presence) for a bit before being fully removed.

</vision>

<essential>
## What Must Be Nailed

All three are equally important:

- **Presence feeling** — Seeing others in real-time must feel instant and magical, like Google Docs
- **Timeline model** — The puzzle ID / timeline ID separation must be solid and intuitive
- **Frictionless joining** — One click or scan to join, no setup required

</essential>

<boundaries>
## What's Out of Scope

- **User accounts/authentication** — No login system for this phase. Nicknames are auto-assigned and stored locally. Editing nicknames is deferred to future versions.

</boundaries>

<specifics>
## Specific Ideas

- **Distinct player colors** — Auto-assign colors that look good together
- **Word-level highlighting** — Highlight the entire clue's cells in the collaborator's color, not just their current cell
- **Join/leave toasts** — Brief notification when someone joins or leaves
- **Avatar row** — Small colored circles/initials in header showing connected collaborators
- **Ghost presence on disconnect** — Show as "away" before removing, handles temporary disconnects gracefully
- **No artificial collaborator limit** — Let WebRTC handle whatever it can
- **Auto-nicknames** — Assigned automatically, stored locally, keeps joining instant

</specifics>

<notes>
## Additional Context

The timeline concept is central to this phase. It's not just about real-time sync (that's Phase 5) — it's about the mental model that you're collaborating on a shared "attempt" at a puzzle, and you can have multiple attempts.

The join flow with merge/save-new options respects existing work-in-progress while keeping the common case (no conflict) completely frictionless.

</notes>

---

*Phase: 06-collaboration*
*Context gathered: 2026-01-11*
