# Phase 8: Polish & PWA - Context

**Gathered:** 2026-01-12
**Status:** Ready for planning

<vision>
## How This Should Work

When you open Crossing Words, you land on a **puzzle library** — not a sample puzzle. The library shows your downloaded puzzles grouped by date, with the source (NYT, Washington Post, etc.) as the clear headline for each puzzle. You can see your progress at a glance and tap to continue solving.

From the library, you can import a puzzle file or download one using the existing picker. Puzzles can be easily deleted without confirmation — they can always be re-downloaded.

**Solving experience** feels like a native app:
- **Header toolbox** contains all non-solving UI: back to library, share, settings, check/reveal menu, and compact collaborator presence indicators
- **Grid** is maximized, taking as much space as possible
- **Single clue bar** shows just the current clue with prev/next buttons to navigate sequentially through clues in the current direction
- **Custom keyboard** at the bottom with letters, navigation, and quick actions (check, reveal, toggle direction)

The layout is **unified across all devices** — same structure on mobile and desktop, just responsive scaling. No more dual-panel clue layout; everyone gets the same clean, focused experience.

**Offline** works seamlessly: an indicator shows when you're disconnected, but solving continues normally. CRDT sync merges everything when you reconnect.

**Themes**: Defaults to system preference (dark/light), but users can manually override.

**Installation**: Let the browser handle install prompts naturally — no pushy banners.

</vision>

<essential>
## What Must Be Nailed

- **Mobile keyboard UX** — If solving on mobile isn't great, none of the rest matters. Keys must be clean and usable, minimal footprint to not hide the grid, but large and clear enough for accurate tapping on small screens.
- **Puzzle library as home** — Start with the library, not a puzzle. Grouped by date, source as headline, progress indicators.
- **Unified responsive layout** — Same experience everywhere, just scaled appropriately.

</essential>

<boundaries>
## What's Out of Scope

- Push notifications — No alerts when collaborators join or puzzles update
- Account system — No login, profiles, or cloud sync of personal data
- Swipe gestures — Keep interactions tap-only, simple and predictable
- Scrollable clue list — Single clue bar only, maximize grid space

</boundaries>

<specifics>
## Specific Ideas

**Library view (ASCII mockup):**
```
┌─────────────────────────────────────────┐
│ Crossing Words            │ ➕ │ 📥 │   │
├─────────────────────────────────────────┤
│ ─── January 12, 2026 ───────────────── │
│  NYT Crossword            ████████░░ 80%│
│  Washington Post          ██░░░░░░░░ 20%│
│ ─── January 11, 2026 ───────────────── │
│  NYT Crossword            ██████████ ✓  │
│  LA Times                 ░░░░░░░░░░ 0% │
└─────────────────────────────────────────┘
```

**Solving view (ASCII mockup):**
```
┌─────────────────────────────────────────┐
│ ← │ NYT • Jan 12      │ ●● │ 📤 │ ⋮ │   │  ← Header (●● = collaborators)
├─────────────────────────────────────────┤
│         ┌───┬───┬───┬───┬───┐          │
│         │ C │ R │ O │ S │ S │          │
│         ├───┼───┼───┼───┼───┤          │
│         │ ░ │ A │ ░ │ T │ E │          │  ← Grid (maximized)
│         └───┴───┴───┴───┴───┘          │
├─────────────────────────────────────────┤
│  ◀  │  3A: "Small or insignificant"  │ ▶ │  ← Clue bar with nav
├─────────────────────────────────────────┤
│ Q W E R T Y U I O P    │ ✓ Check  │    │
│  A S D F G H J K L     │ 👁 Reveal │    │  ← Keyboard + actions
│   Z X C V B N M ⌫     │ ↔️ Toggle │    │
└─────────────────────────────────────────┘
```

**Collaborator presence:** Compact overlapping colored dots in header, expandable on tap to show names

**Clue navigation:** Prev/next buttons step through clues by number within current direction (across or down)

**Delete puzzles:** Easy delete from library, no confirmation needed

</specifics>

<notes>
## Additional Context

The #1 priority is mobile keyboard UX — this is what makes or breaks the mobile solving experience.

The shift from "always show a puzzle" to a library home view is a significant UX change that makes the app feel more like a proper native application rather than a web demo.

Unified design across devices simplifies development and ensures consistency. The current dual-panel clue layout on desktop will be replaced with the same focused single-clue-bar experience.

</notes>

---

*Phase: 08-polish-pwa*
*Context gathered: 2026-01-12*
