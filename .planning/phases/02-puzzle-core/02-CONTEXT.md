# Phase 2: Puzzle Core - Context

**Gathered:** 2026-01-11
**Status:** Ready for planning

<vision>
## How This Should Work

The puzzle solving experience centers on the grid with the current clue displayed in a bottom bar. When you select a cell, you see the relevant clue immediately below the grid — no hunting through sidebars.

Navigation should feel natural: type a letter and the cursor auto-advances to the next cell in the current word. Arrow keys work for moving around. Tap/click the same cell to toggle between Across and Down direction. The whole word you're working on should be highlighted so you know where you are.

</vision>

<essential>
## What Must Be Nailed

- **Correct crossword behavior** — Auto-advance after typing, direction toggle on same-cell tap, current word highlighting. These are the mechanics that make crossword solving feel right.
- Grid must feel responsive — no perceptible lag between keypress and letter appearing

</essential>

<boundaries>
## What's Out of Scope

- File import (.puz, .ipuz, .jpz) — that's Phase 3
- Check/reveal functionality — that's Phase 7
- Any multiplayer/sync features — that's Phases 4-6
- Mobile keyboard customization — that's Phase 8

This phase is purely about the core grid solving mechanics with a hardcoded sample puzzle.

</boundaries>

<specifics>
## Specific Ideas

No specific references — keep it simple and make it feel good. Should integrate naturally with the existing dark theme from Phase 1.

- Bottom bar for current clue display
- Auto-advance on letter entry
- Same-cell tap/click to toggle Across/Down direction
- Visual highlight of the current word

</specifics>

<notes>
## Additional Context

The grid rendering needs to be solid enough that later phases can layer multiplayer features on top. But for now, focus purely on single-player solving with correct crossword mechanics.

</notes>

---

*Phase: 02-puzzle-core*
*Context gathered: 2026-01-11*
