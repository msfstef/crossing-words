# Navigation System

This document describes how navigation and movement work in the crossword puzzle grid.

## Letter Entry (A-Z)

1. Fill cell with letter
2. Auto-advance to next empty cell:
   - If empty cells remain in current clue → move to next empty cell in clue
   - If at last cell but other empties in clue → wrap to first empty in same clue
   - If no empties left in clue → jump to next clue with empties (by clue number, within same orientation)
     - e.g., after completing 1-Across → 2-Across → 3-Across (stays in across orientation)
     - e.g., after completing 1-Down → 2-Down → 3-Down (stays in down orientation)
   - If all clues in current orientation are complete → switch to other orientation
   - If ALL clues filled → stay in place

## Backspace

- **Filled cell**: Clear it AND move back to previous cell
- **Empty cell**: Move back one cell (don't clear previous)
- **First cell of clue**: Navigate to last cell of previous clue
- **First clue (1-Across)**: Wrap to last cell of last clue
- **Skip verified cells** when moving backwards

## Delete

- Clear current cell, stay in place
- No effect on verified cells

## Arrow Keys (Up/Down/Left/Right)

- Move one cell in arrow direction
- Skip black cells (find next white cell in that direction)
- If only black cells before edge → stay in place
- Stop at puzzle edge (no wrapping)
- Keep current direction (don't switch based on arrow)
- Don't skip filled cells

## Spacebar

- Toggle direction (across ↔ down)
- Only if alternate direction has valid clue at current cell

## Tab / Shift+Tab

- **Tab**: Go to next clue by clue number (wraps to first clue after last)
- **Shift+Tab**: Go to previous clue by clue number (wraps to last clue from first)
- Goes to first empty cell in target clue (or first cell if all filled)
- Stays within current orientation (across or down)

## Cell Click/Tap

- **Different cell**: Select it, keep current direction
  - If current direction has no clue at new cell → switch to available direction
- **Same cell**: Toggle direction
- **Black cell**: Ignore

## Swipe Gesture (Mobile)

- Move one cell in swipe direction (same as arrow keys)
- Skip black cells (find next white cell in that direction)
- If only black cells before edge → stay in place
- Stop at edge
- **Swipe zones**: Respond to swipes on grid, virtual keyboard, AND clue bar
  - Enables convenient thumb navigation on mobile without reaching for the grid

## Clue Navigation Buttons (Next/Prev)

- Go to first empty cell in target clue (or first cell if all filled)
- Navigation by clue number within current orientation
- Wrap: last clue → first clue, first clue → last clue

## Verified Cells

- Cannot be edited (typing skips over them)
- Cannot be cleared (backspace/delete has no effect)
- Navigation skips over them during auto-advance and backspace

## Initial State

- Select first cell of 1-Across on puzzle load
- Direction defaults to across

## Virtual Keyboard

- Letters (A-Z) + Backspace only
- Same behavior as physical keyboard

## Test Coverage

Navigation behavior is verified by comprehensive unit tests in `src/__tests__/navigation/navigationBehavior.test.ts`. These tests serve as executable specifications and should be updated when behavior changes.
