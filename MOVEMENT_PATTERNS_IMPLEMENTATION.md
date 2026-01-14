# Movement Patterns Implementation

## Summary

This document describes the new movement patterns implemented in the crossword application.

## Changes Made

### 1. Core Helper Functions (src/hooks/usePuzzleState.ts)

Added several new helper functions to support intelligent movement patterns:

- **`findFirstEmptyCellInClue(clue, dir)`**: Finds the first empty cell in a clue. If all cells are filled, returns the first cell.

- **`countEmptyCellsInClue(clue, dir)`**: Counts how many empty cells remain in a clue (excluding verified cells).

- **`findNextClueWithEmptyCells(currentClueNumber, dir, searchOtherDirection)`**: Finds the next clue that has empty cells, searching by clue number order. Optionally searches the other direction (across/down) after exhausting the current direction.

- **`isLastCellInClue(row, col, dir)`**: Checks if the current cell is the last cell (rightmost for across, bottommost for down) in the clue.

### 2. Movement Patterns Implemented

#### Pattern 1: Clue Navigation (goToNextClue)
**Behavior**: When navigating clues using the clue bar, go to the next available empty cell following the order of the clue number for the given orientation, and then the other orientation. If all cells are filled, simply move to the first cell of the next clue.

**Implementation**:
- Modified `goToNextClue()` to use `findNextClueWithEmptyCells()` with `searchOtherDirection=true`
- Navigates to the first empty cell of the next clue using `findFirstEmptyCellInClue()`
- Automatically switches direction if needed
- Falls back to standard behavior if all cells are filled

**Location**: src/hooks/usePuzzleState.ts:822-842

#### Pattern 2: Last Cell Behavior (autoAdvance)
**Behavior**: When filling in the last cell in the word (rightmost/bottommost):
- If the clue has other empty cells, go to the first (leftmost/topmost) empty cell of the same clue
- Otherwise, if this was the only missing cell, go to the next empty cell in the next clue that has empty cells, following clue number order in the current orientation, then the other orientation
- If all cells are filled, go to the first cell of the next clue number in the current orientation

**Implementation**:
- Modified `autoAdvance()` to check if the current cell is the last cell using `isLastCellInClue()`
- If last cell:
  - Count remaining empty cells in the clue
  - If empty cells remain: wrap to first empty cell
  - If no empty cells: use `findNextClueWithEmptyCells()` to find next incomplete clue
  - If all filled: move to next clue
- If not last cell: normal auto-advance behavior within the clue

**Location**: src/hooks/usePuzzleState.ts:483-537

#### Pattern 3: Swipe Behavior (handleSwipeNavigation)
**Behavior**: When swiping, instead of going to the topmost/leftmost cell of the clue, go to the first empty cell of said clue. If all are filled, go to the topmost/leftmost cell.

**Implementation**:
- Modified `handleSwipeNavigation()` to use the clue object from swipe navigation helpers
- After finding the target clue, calls `findFirstEmptyCellInClue()` to get the first empty cell
- Falls back to first cell if all cells are filled
- Also updated all swipe helper functions to return `Clue` objects instead of cell positions:
  - `findNextAcrossClueInRow()`
  - `findNextAcrossClueInColumn()`
  - `findNextDownClueInColumn()`
  - `findNextDownClueInRow()`

**Location**: src/hooks/usePuzzleState.ts:1021-1068

### 3. Updated Functions

- **`goToClue(clueNumber, dir?)`**: Now selects the first empty cell of the target clue instead of always selecting the first cell

## Testing

### Playwright Tests
Created comprehensive E2E tests in `e2e/movement-patterns.spec.ts` to validate:

1. **Clue navigation goes to first empty cell**
2. **Filling last cell with other empty cells wraps to first empty cell**
3. **Filling the only missing cell advances to next clue with empty cells**
4. **Normal auto-advance continues within clue**
5. **Swipe navigation goes to first empty cell**

### Manual Testing Steps

To manually test the new movement patterns:

1. **Test Clue Navigation**:
   - Fill some cells in a clue, leaving others empty
   - Click the "Next Clue" button in the clue bar
   - Verify it navigates to the first empty cell of the next clue

2. **Test Last Cell Wrapping**:
   - In a clue with multiple empty cells, fill the last cell
   - Verify the cursor moves to the first empty cell in the same clue

3. **Test Only Missing Cell Behavior**:
   - Fill all cells in a clue except one (not the last cell)
   - Navigate to the last cell and fill it
   - Verify it advances to the next clue with empty cells

4. **Test Swipe Navigation**:
   - Swipe to navigate between clues
   - Verify the cursor lands on the first empty cell of the target clue

## Architecture Improvements

The new implementation provides:

1. **Better Abstraction**: Helper functions encapsulate common movement logic
2. **Configurable Navigation**: Easy to modify navigation behavior by adjusting helper functions
3. **Elegant Code**: Movement patterns are expressed concisely using composable helpers
4. **Consistent Behavior**: All navigation methods now respect empty cell prioritization

## Files Modified

- `src/hooks/usePuzzleState.ts`: Core movement logic implementation
- `e2e/movement-patterns.spec.ts`: New E2E tests (created)

## Build Status

✅ TypeScript compilation successful
✅ No linting errors
✅ All helper functions properly ordered
✅ All dependencies correctly managed
