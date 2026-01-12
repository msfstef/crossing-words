---
phase: 09-ui-refinements
plan: 01
subsystem: ui
tags: [fab, dialog, optimistic-ui, mobile, react]

# Dependency graph
requires:
  - phase: 08-polish
    provides: Library view, file import, puzzle download functionality
provides:
  - FAB component for mobile-friendly actions
  - Download dialog modal
  - Optimistic UI pattern with ghost entries
  - LoadingCard component for loading states
affects: [library, mobile-ux]

# Tech tracking
tech-stack:
  added: []
  patterns: [optimistic-ui, ghost-entries, fab-expand-animation]

key-files:
  created:
    - src/components/Library/FAB.tsx
    - src/components/Library/FAB.css
    - src/components/Library/DownloadDialog.tsx
    - src/components/Library/DownloadDialog.css
    - src/components/Library/LoadingCard.tsx
    - src/components/Library/LoadingCard.css
  modified:
    - src/components/Library/LibraryView.tsx
    - src/components/Library/LibraryView.css

key-decisions:
  - "FAB expands vertically with transform/opacity animation"
  - "Ghost entries appear immediately in library during download"
  - "LoadingCard uses pulse animation and spinner"
  - "Download dialog centered with backdrop"

patterns-established:
  - "Optimistic UI: ghost entry → success replaces with real → error removes ghost"
  - "FAB pattern: expand/collapse with outside-click handling"

issues-created: []

# Metrics
duration: 11min
completed: 2026-01-12
---

# Phase 9 Plan 01: FAB and Optimistic Download UI Summary

**Floating Action Button with expand animation and optimistic UI for puzzle downloads - ghost entries appear immediately during download**

## Performance

- **Duration:** 11 min
- **Started:** 2026-01-12T17:00:18Z
- **Completed:** 2026-01-12T17:11:43Z
- **Tasks:** 2 auto + 1 checkpoint (verified with Playwright)
- **Files modified:** 8

## Accomplishments

- Created FAB component that replaces header Import/Download buttons on mobile
- Implemented smooth expand/collapse animation with transform/opacity
- Created DownloadDialog modal with source selector and date picker
- Implemented optimistic UI pattern with ghost entries during download
- Created LoadingCard component for ghost entry display with pulse animation
- Eliminated header overflow on 390px mobile viewports

## Task Commits

Each task was committed atomically:

1. **Task 1: Create FAB component with expand animation** - `ab30866` (feat)
2. **Task 2: Create download dialog with optimistic UI** - `9970aa2` (feat)

**Plan metadata:** This commit (docs: complete plan)

## Files Created/Modified

- `src/components/Library/FAB.tsx` - Floating action button with expand/collapse
- `src/components/Library/FAB.css` - FAB styling with animations
- `src/components/Library/DownloadDialog.tsx` - Modal dialog for download selection
- `src/components/Library/DownloadDialog.css` - Dialog styling
- `src/components/Library/LoadingCard.tsx` - Ghost entry card during download
- `src/components/Library/LoadingCard.css` - Loading card with pulse animation
- `src/components/Library/LibraryView.tsx` - Integrated FAB, dialog, ghost entries
- `src/components/Library/LibraryView.css` - Added hidden file input style

## Decisions Made

- FAB uses 56px diameter circular button with + icon that rotates 45° to × on expand
- Options expand upward above FAB with 0.75rem gap
- Download dialog is modal with centered layout and backdrop
- Ghost entries use pulse animation (opacity 0.6-1.0) and spinner
- Download does NOT auto-open puzzle - user stays in library to see entry appear

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- FAB and optimistic UI complete
- Ready for next plan in Phase 9

---
*Phase: 09-ui-refinements*
*Completed: 2026-01-12*
