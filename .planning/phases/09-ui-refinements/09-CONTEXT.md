# Phase 9: UI Refinements - Context

**Gathered:** 2026-01-12
**Status:** Ready for planning

<vision>
## How This Should Work

This is a comprehensive usability polish pass. The app works, but several friction points make it feel unfinished. The goal is to address every awkward interaction so the app feels smooth and intentional.

**Library View Improvements:**
- Replace the import/download buttons (which overflow on 390px screens) with a floating action button (FAB) in the bottom right. Tapping it expands vertically into "Import" and "Download" options. Download opens a dedicated picker dialog.
- Downloading a puzzle should NOT immediately open it. Instead, add a ghost/loading entry to the list immediately, which seamlessly becomes the real puzzle when downloaded or disappears with an error toast if it fails.
- Show Source (e.g., "Universal Crossword") instead of puzzle title in the library list.
- Replace the "In Progress" text with a compact progress circle showing percentage of cells filled. Complete puzzles show a filled circle with checkmark.

**Puzzle View Improvements:**
- Fix the broken dialogs (Check, Reveal, Settings gear don't open).
- Consolidate Check, Reveal, and Auto-check into the Settings dialog with clear sections.
- Make the auto-check toggle prettier.
- Move Share button next to Settings gear, use standard share icons, remove the red color.
- Display puzzle title above the grid, above the attribution.
- Auto-select the first horizontal clue when opening a puzzle (avoids the smaller "Select a clue" placeholder bar).
- Make the clue bar taller, with text that wraps and scales to fit (clues are currently cut off).
- Tapping the clue bar should toggle direction (horizontal/vertical).

</vision>

<essential>
## What Must Be Nailed

All of these refinements ship together — they're a cohesive polish pass:

- **FAB + download flow** — Adding puzzles should feel smooth with optimistic UI
- **Clue bar + auto-select** — Clues must be readable and selection intuitive
- **Toolbar consolidation** — Less clutter, controls in logical places
- **Bug fixes** — Dialogs must actually open and work

</essential>

<boundaries>
## What's Out of Scope

- **Performance optimization** — This phase is about feel and usability, not speed
- New features beyond fixing what exists
- Major architectural changes

</boundaries>

<specifics>
## Specific Ideas

- FAB and progress circles should fit the app's existing style (no specific reference — just make it feel native)
- Mobile viewport (390px) is the critical test case for overflow issues
- Ghost/loading entries for downloads should feel like optimistic UI patterns

</specifics>

<notes>
## Additional Context

**Implementation guidance:**
- Use the frontend-design skill for visual work
- Verify all changes with Playwright at appropriate viewports (especially 390px mobile)
- Ensure dialogs open and are usable
- Confirm clues are not cropped after changes

The user has been actively using the app and identified these friction points from real usage. These aren't theoretical — they're felt pain points.

</notes>

---

*Phase: 09-ui-refinements*
*Context gathered: 2026-01-12*
