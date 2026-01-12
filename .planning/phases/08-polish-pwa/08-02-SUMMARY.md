# Plan 08-02 Summary: Puzzle Library View

## Objective
Create puzzle library view as the new home screen with puzzle list grouped by date.

## Completed Tasks

### Task 1: Extend puzzle storage for library management
- Upgraded IndexedDB to version 2 with new `puzzles-meta` store
- Added `PuzzleEntry` interface for metadata storage
- Implemented `listAllPuzzles()` to retrieve all saved puzzles with metadata
- Implemented `deletePuzzle()` to remove puzzle and its metadata
- Implemented `getPuzzleProgress()` to calculate fill percentage from CRDT state
- Added `extractSource()` and `extractDate()` helpers for metadata extraction
- Updated `savePuzzle()` to store both puzzle data and metadata

### Task 2: Create LibraryView and PuzzleCard components
- Created `PuzzleCard.tsx` component with:
  - Source/title display
  - Progress bar with percentage
  - Completed state with checkmark
  - Delete button with stopPropagation
  - Keyboard accessibility (Enter/Space to open)
- Created `LibraryView.tsx` component with:
  - Header with "Crossing Words" title
  - Import file and download puzzle buttons
  - Date-grouped puzzle list
  - Empty state with call-to-action
  - Progress loading for each puzzle

### Task 3: Integrate library as home screen in App.tsx
- Added `activeView: 'library' | 'solve'` state
- Default to library unless URL has timeline (shared session)
- Conditional rendering between LibraryView and solve view
- Added Back button in header during solve view
- Updated error banner positioning for library context

### Task 4: Verification with Playwright
- Verified library shows as home screen
- Verified puzzle download saves to library correctly
- Verified puzzle cards show progress indicators
- Verified navigation between library and solve view
- Verified Back button returns to library with puzzle visible

## Bug Fixed
- **Puzzle not appearing in library after import**: `handlePuzzleLoaded` was opening puzzle without calling `savePuzzle()`. Fixed by ensuring metadata is persisted before navigation.

## Files Changed
- `src/lib/puzzleStorage.ts` - Extended with library management functions
- `src/components/Library/LibraryView.tsx` - New library view component
- `src/components/Library/LibraryView.css` - Library styles
- `src/components/Library/PuzzleCard.tsx` - New puzzle card component
- `src/components/Library/PuzzleCard.css` - Puzzle card styles
- `src/components/Library/index.ts` - Component exports
- `src/App.tsx` - Refactored for library-first navigation
- `src/App.css` - Updated header and navigation styles

## Commits
- `68963c4` feat(08-02): extend puzzleStorage with library management
- `7b0bc94` feat(08-02): create LibraryView and PuzzleCard components
- `e62d948` feat(08-02): integrate library as home screen in App.tsx
- `9fe02d0` fix(08-02): save puzzle to library when imported

## Duration
~15 minutes

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Separate puzzles-meta store | Efficient listing without loading full puzzle data |
| PuzzleEntry with savedAt index | Sort by most recent, group by date |
| puzzleId from sanitized title | Consistent ID generation across import paths |
| Library as default, solve on selection | Transforms app from puzzle-first to library-first UX |
| Back button in header | Clear navigation between views |
