---
phase: 09-ui-refinements
plan: 04
subsystem: ui
tags: [clue-bar, ux, theme, accessibility]

# Dependency graph
requires:
  - phase: 08-polish-pwa
    provides: Theme system with CSS variables
  - phase: 02-puzzle-core
    provides: Direction toggle logic
provides:
  - Improved clue bar with text wrapping and fixed height
  - Tap-to-toggle direction on clue bar
  - Auto-select first clue on puzzle open
  - Theme support for CrosswordGrid and ShareDialog
affects: [ui, solve-view]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Font size auto-shrinking for long content"
    - "Keyboard-style button styling (no outline, background change)"

key-files:
  created: []
  modified:
    - src/components/ClueBar.tsx
    - src/components/ClueBar.css
    - src/hooks/usePuzzleState.ts
    - src/components/CrosswordGrid.css
    - src/components/ShareDialog.css
    - src/components/Layout/SolveHeader.css
    - src/components/SettingsMenu.css

key-decisions:
  - "Fixed 56px clue bar height (fits 2 lines)"
  - "Number and text wrap as one continuous string"
  - "Auto-shrink font from 15px to 13px for overflow"
  - "No visual feedback on clue bar tap (just cursor)"
  - "Nav buttons styled like keyboard keys"

patterns-established:
  - "useRef + useEffect for measuring text overflow and adjusting font size"

issues-created: []

# Metrics
duration: 37min
completed: 2026-01-12
---

# Phase 9 Plan 4: Clue Bar Improvements Summary

**Improved clue bar with fixed height, text wrapping, tap-to-toggle direction, auto-select on open, and full light/dark theme support**

## Performance

- **Duration:** 37 min
- **Started:** 2026-01-12T18:55:07Z
- **Completed:** 2026-01-12T19:32:13Z
- **Tasks:** 4 (3 auto + 1 checkpoint)
- **Files modified:** 8

## Accomplishments

- Clue bar now has fixed 56px height with 2-line text wrapping
- Long clues auto-shrink font size to fit (15px → 13px)
- Tapping clue bar content toggles direction (when alternate clue exists)
- First across clue auto-selected when opening a puzzle (no placeholder)
- CrosswordGrid and ShareDialog now properly support light/dark themes
- Share and Settings buttons visible in light mode with proper borders

## Task Commits

Each task was committed atomically:

1. **Task 1: Make clue bar taller with text wrapping** - `80a5d91` (feat)
2. **Task 2: Add tap-to-toggle direction on clue bar** - `1354b1a` (feat)
3. **Task 3: Auto-select first horizontal clue on puzzle open** - `25d2ac6` (feat)
4. **Checkpoint fixes: Polish and theme support** - `7952379` (fix)

## Files Created/Modified

- `src/components/ClueBar.tsx` - Added font shrinking logic, combined number+text
- `src/components/ClueBar.css` - Fixed height, wrapping, keyboard-style nav buttons
- `src/hooks/usePuzzleState.ts` - Added toggleDirection and auto-select on ready
- `src/App.tsx` - Pass toggleDirection to ClueBar
- `src/components/CrosswordGrid.css` - Use theme variables for light/dark
- `src/components/ShareDialog.css` - Use theme variables, fix overflow
- `src/components/Layout/SolveHeader.css` - Share button uses theme variables
- `src/components/SettingsMenu.css` - Settings button uses theme variables

## Decisions Made

- Fixed 56px height fits 2 lines of text comfortably
- Clue number and text treated as one string for natural wrapping
- Font shrinks from 15px to 13px when content overflows 2 lines
- No visual feedback on clue bar tap (cursor pointer only, no outline/highlight)
- Nav buttons styled like virtual keyboard keys (background change, no outline)
- QR container in ShareDialog stays white for readability in both themes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CrosswordGrid hardcoded dark colors**
- **Found during:** Checkpoint verification
- **Issue:** Grid used hardcoded dark colors, not visible properly in light mode
- **Fix:** Replaced with theme CSS variables
- **Files modified:** src/components/CrosswordGrid.css
- **Committed in:** 7952379

**2. [Rule 1 - Bug] ShareDialog hardcoded dark colors**
- **Found during:** Checkpoint verification
- **Issue:** Dialog used hardcoded colors and had horizontal overflow
- **Fix:** Used theme variables, added overflow:hidden and box-sizing
- **Files modified:** src/components/ShareDialog.css
- **Committed in:** 7952379

**3. [Rule 1 - Bug] Header buttons invisible in light mode**
- **Found during:** Checkpoint verification
- **Issue:** Share and Settings buttons used rgba(255,255,255,0.1) - invisible in light mode
- **Fix:** Changed to use --color-bg-tertiary and --color-border
- **Files modified:** src/components/Layout/SolveHeader.css, src/components/SettingsMenu.css
- **Committed in:** 7952379

---

**Total deviations:** 3 auto-fixed (all bugs)
**Impact on plan:** All fixes necessary for proper theme support. No scope creep.

## Issues Encountered

None - all tasks completed successfully.

## Next Phase Readiness

- Clue bar is now fully functional with improved UX
- Theme support complete across all major components
- Ready for Phase 09-05 (if exists) or phase completion

---
*Phase: 09-ui-refinements*
*Completed: 2026-01-12*
