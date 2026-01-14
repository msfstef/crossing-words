# Puzzle Testing Guide

This guide covers how to effectively test puzzle-related features in Crossing Words, including the test puzzle generator, E2E testing strategies, and dev mode utilities.

## Quick Reference

### Loading Test Puzzles

```bash
# Via URL (fastest for E2E tests)
http://localhost:5173?testPuzzle=standard
http://localhost:5173?testPuzzle=custom&width=10&height=10

# Pre-defined sizes:
?testPuzzle=mini              # 5x5
?testPuzzle=standard          # 15x15
?testPuzzle=sunday            # 21x21
?testPuzzle=large             # 25x25
?testPuzzle=standardSymmetric # 15x15 with symmetric black cells
?testPuzzle=standardDense     # 15x15 with dense black cells
?testPuzzle=standardHalfFilled # 15x15 with 50% pre-filled
?testPuzzle=sundayNearComplete # 21x21 with 80% pre-filled
```

### Browser Console (Dev Mode)

```javascript
// Access pre-defined puzzles
window.__TEST_PUZZLES__.mini
window.__TEST_PUZZLES__.standard

// Create custom puzzle
window.__createTestPuzzle__({ width: 10, height: 10 })

// Load puzzle dynamically
window.__loadTestPuzzle__('sunday')

// Check currently loaded puzzle
window.__CURRENT_TEST_PUZZLE__
```

---

## Test Puzzle Generator

### Overview

The test puzzle generator (`src/lib/testPuzzleGenerator.ts`) creates deterministic puzzles for testing. Each puzzle is reproducible - the same parameters always produce the same puzzle.

### Basic Usage

```typescript
import { createTestPuzzle, TEST_PUZZLES } from '../lib/testPuzzleGenerator';

// Use pre-defined puzzles
const miniPuzzle = TEST_PUZZLES.mini;       // 5x5
const standardPuzzle = TEST_PUZZLES.standard; // 15x15
const sundayPuzzle = TEST_PUZZLES.sunday;     // 21x21
const largePuzzle = TEST_PUZZLES.large;       // 25x25

// Create custom size
const customPuzzle = createTestPuzzle({ width: 10, height: 10 });
```

### Configuration Options

```typescript
interface TestPuzzleOptions {
  width: number;
  height: number;
  title?: string;
  author?: string;

  // Black cell patterns
  blackCellPattern?:
    | 'none'       // All white cells (simple layout testing)
    | 'standard'   // Sparse, predictable pattern
    | 'symmetric'  // 180-degree rotational symmetry
    | 'dense'      // ~25% black cells
    | 'minimal';   // Only corner black cells

  // Reproducible randomness
  seed?: number;  // Same seed = same puzzle

  // Partial completion
  prefillPercent?: number;  // 0-100, percentage of cells pre-filled

  // Custom clue text
  clueTextGenerator?: (
    clueNumber: number,
    direction: 'across' | 'down',
    length: number
  ) => string;
}
```

### Pre-defined Test Puzzles

| Name | Size | Pattern | Pre-filled | Use Case |
|------|------|---------|------------|----------|
| `mini` | 5x5 | standard | 0% | Quick tests, basic rendering |
| `standard` | 15x15 | standard | 0% | Typical daily crossword testing |
| `sunday` | 21x21 | standard | 0% | Larger format testing |
| `large` | 25x25 | standard | 0% | Stress testing, scrolling |
| `miniNoBlack` | 5x5 | none | 0% | Simple grid layout |
| `standardSymmetric` | 15x15 | symmetric | 0% | Realistic layout |
| `standardDense` | 15x15 | dense | 0% | Crowded grid testing |
| `standardHalfFilled` | 15x15 | standard | 50% | Partial completion |
| `sundayNearComplete` | 21x21 | standard | 80% | Near-completion testing |

### Creating Custom Test Scenarios

```typescript
// Puzzle with specific seed for reproducibility
const puzzle1 = createTestPuzzle({
  width: 15,
  height: 15,
  seed: 42
});

// Test partial completion state
const partialPuzzle = createTestPuzzle({
  width: 15,
  height: 15,
  prefillPercent: 50,
});
// Access pre-filled entries: partialPuzzle.prefilledEntries

// Custom clue text for specific tests
const customClues = createTestPuzzle({
  width: 10,
  height: 10,
  clueTextGenerator: (num, dir, len) =>
    `${dir.toUpperCase()} #${num}: Find a ${len}-letter word`,
});

// Dense pattern for testing crowded layouts
const densePuzzle = createTestPuzzle({
  width: 15,
  height: 15,
  blackCellPattern: 'dense',
});
```

---

## E2E Testing with Playwright

### Setup

The E2E test helpers are in `e2e/helpers/testPuzzleHelpers.ts`.

```typescript
import { test, expect } from '@playwright/test';
import {
  navigateToTestPuzzle,
  waitForPuzzleReady,
  assertGridFullyVisible,
  assertPuzzleDimensions,
  STANDARD_VIEWPORTS,
} from './helpers/testPuzzleHelpers';
```

### Loading Test Puzzles

#### Via URL Parameters (Recommended)

The fastest and most reliable method for E2E tests:

```typescript
test('grid renders standard puzzle', async ({ page }) => {
  // Navigate directly to test puzzle
  await navigateToTestPuzzle(page, 'standard');
  await waitForPuzzleReady(page);

  // Assertions...
  await assertGridFullyVisible(page);
});

test('custom size puzzle', async ({ page }) => {
  await navigateToTestPuzzle(page, 'custom', {
    width: 10,
    height: 10,
    pattern: 'symmetric',
  });
  await waitForPuzzleReady(page);

  await assertPuzzleDimensions(page, 10, 10);
});
```

#### Dynamic Loading

For testing multiple puzzle sizes without page reloads:

```typescript
test('test multiple sizes', async ({ page }) => {
  await navigateToApp(page);

  for (const size of ['mini', 'standard', 'large']) {
    await loadTestPuzzleDynamically(page, size);
    await waitForPuzzleReady(page);

    const result = await isGridFullyVisible(page);
    expect(result.visible).toBe(true);
  }
});
```

### Viewport Testing

Test across multiple device sizes:

```typescript
import { STANDARD_VIEWPORTS } from './helpers/testPuzzleHelpers';

const viewports = [
  { name: 'iPhone SE', ...STANDARD_VIEWPORTS.iPhoneSE },
  { name: 'iPhone 8', ...STANDARD_VIEWPORTS.iPhone8 },
  { name: 'iPad', ...STANDARD_VIEWPORTS.iPad },
  { name: 'Desktop', ...STANDARD_VIEWPORTS.desktop },
];

for (const viewport of viewports) {
  test(`grid visible at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await navigateToTestPuzzle(page, 'standard');
    await waitForPuzzleReady(page);

    await assertGridFullyVisible(page);
  });
}
```

### Grid Inspection

```typescript
import {
  getCellSize,
  getUniqueCellSizes,
  getCellCount,
  getBlackCellCount,
  getCurrentTestPuzzle,
  assertConsistentCellSizing,
} from './helpers/testPuzzleHelpers';

test('cells are consistently sized', async ({ page }) => {
  await navigateToTestPuzzle(page, 'standard');
  await waitForPuzzleReady(page);

  // All cells should have the same dimensions
  await assertConsistentCellSizing(page);

  // Or inspect manually
  const sizes = await getUniqueCellSizes(page);
  expect(sizes.length).toBeLessThanOrEqual(2); // Allow 1px rounding
});

test('correct cell count', async ({ page }) => {
  await navigateToTestPuzzle(page, 'sunday');
  await waitForPuzzleReady(page);

  const count = await getCellCount(page);
  expect(count).toBe(21 * 21); // 441 cells
});
```

### Best Practices

1. **Always use URL params when possible** - Faster and more reliable than dynamic loading

2. **Wait for puzzle ready** - Don't interact with the grid until `waitForPuzzleReady()` completes

3. **Test multiple viewports** - UI issues often appear only at specific screen sizes

4. **Test edge cases** - Mini puzzles, large puzzles, dense patterns

5. **Use assertions with clear messages** - `assertGridFullyVisible(page)` provides detailed error info

---

## Dev Mode Utilities

### URL Parameters

When running the dev server (`npm run dev`), test puzzles can be loaded via URL:

```
http://localhost:5173?testPuzzle=standard
http://localhost:5173?testPuzzle=custom&width=10&height=10&pattern=symmetric&prefill=30
```

Parameters for custom puzzles:
- `width` - Grid width (3-50)
- `height` - Grid height (3-50)
- `pattern` - Black cell pattern (none, standard, symmetric, dense, minimal)
- `prefill` - Percentage of cells pre-filled (0-100)

### Browser Console

In dev mode, the following are available on `window`:

```javascript
// Pre-defined test puzzles
window.__TEST_PUZZLES__

// Create custom puzzle
window.__createTestPuzzle__({ width: 15, height: 15 })

// Load puzzle into app
window.__loadTestPuzzle__('standard')

// Get currently loaded puzzle
window.__CURRENT_TEST_PUZZLE__
```

### Console Output

When test puzzle dev tools initialize, you'll see:

```
[Test Puzzles] Dev tools initialized
Available test puzzles: mini, standard, sunday, large, ...
Usage:
  - window.__TEST_PUZZLES__.mini
  - window.__createTestPuzzle__({ width: 10, height: 10 })
  - Add ?testPuzzle=standard to URL
```

---

## Testing Checklist

When testing puzzle-related features, ensure you cover:

### Grid Rendering
- [ ] Mini puzzle (5x5) renders correctly
- [ ] Standard puzzle (15x15) renders correctly
- [ ] Large puzzle (25x25) renders correctly
- [ ] Grid is fully visible (not clipped) at all viewport sizes
- [ ] Cells are consistently sized
- [ ] Black cells render correctly
- [ ] Clue numbers are visible

### Viewport Sizes
- [ ] Mobile portrait (320x568 - iPhone SE)
- [ ] Mobile standard (375x667 - iPhone 8)
- [ ] Tablet (768x1024 - iPad)
- [ ] Desktop (1920x1080)

### Black Cell Patterns
- [ ] No black cells (pattern: 'none')
- [ ] Standard pattern
- [ ] Symmetric pattern
- [ ] Dense pattern (~25% black)

### Edge Cases
- [ ] Very small puzzles (3x3)
- [ ] Very large puzzles (25x25+)
- [ ] Non-square puzzles (e.g., 15x21)
- [ ] Puzzles with many clue references
- [ ] Partially filled puzzles

---

## Common Test Patterns

### Testing Grid Sizing After Resize

```typescript
test('grid resizes correctly', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await navigateToTestPuzzle(page, 'standard');
  await waitForPuzzleReady(page);

  const initialSize = await getCellSize(page);

  // Resize to smaller viewport
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(300); // Wait for resize

  const newSize = await getCellSize(page);

  // Cells should be smaller
  expect(newSize.width).toBeLessThan(initialSize.width);

  // Grid should still be visible
  await assertGridFullyVisible(page);
});
```

### Testing Multiple Puzzle Sizes

```typescript
const puzzleSizes = ['mini', 'standard', 'sunday', 'large'] as const;

for (const size of puzzleSizes) {
  test(`${size} puzzle renders correctly`, async ({ page }) => {
    await navigateToTestPuzzle(page, size);
    await waitForPuzzleReady(page);

    await assertGridFullyVisible(page);
    await assertConsistentCellSizing(page);
  });
}
```

### Testing Partial Completion State

```typescript
test('half-filled puzzle shows entries', async ({ page }) => {
  await navigateToTestPuzzle(page, 'standardHalfFilled');
  await waitForPuzzleReady(page);

  // Verify some cells have content
  const filledCells = await page.evaluate(() => {
    const cells = document.querySelectorAll('.crossword-cell:not(.cell--black)');
    let filled = 0;
    cells.forEach(cell => {
      if (cell.textContent?.trim()) filled++;
    });
    return filled;
  });

  expect(filledCells).toBeGreaterThan(0);
});
```

---

## Troubleshooting

### "Test puzzle loader not available"

The app is not in dev mode. Ensure:
1. You're running `npm run dev` (not production build)
2. The URL is `localhost` (not a deployed URL)

### Grid not visible in E2E tests

1. Make sure to call `waitForPuzzleReady(page)` after navigation
2. Check viewport size - very small viewports may have issues
3. Use `isGridFullyVisible(page)` to diagnose specific issues

### Inconsistent test results

1. Use fixed seeds when testing specific layouts: `{ seed: 42 }`
2. Clear browser storage between tests if testing persistence
3. Use the E2E helpers which include proper waits

### Tests timeout waiting for puzzle

1. Increase timeout in `waitForPuzzleReady(page, 60000)`
2. Check if dev server is running on the expected port
3. Look for console errors in the browser

---

## Integration with Unit Tests

For unit tests (Vitest), import directly from the generator:

```typescript
import { createTestPuzzle, TEST_PUZZLES } from '../lib/testPuzzleGenerator';
import { calculateCellSize } from '../components/CrosswordGrid';

describe('Grid sizing calculations', () => {
  it('calculates correct cell size for mini puzzle', () => {
    const puzzle = TEST_PUZZLES.mini;
    const containerWidth = 300;
    const containerHeight = 300;

    const cellSize = calculateCellSize(
      puzzle.width,
      puzzle.height,
      containerWidth,
      containerHeight
    );

    expect(cellSize).toBe(60); // 300 / 5
  });

  it('handles non-square puzzles', () => {
    const puzzle = createTestPuzzle({ width: 15, height: 21 });
    // ... test calculations
  });
});
```

---

## File Locations

| File | Purpose |
|------|---------|
| `src/lib/testPuzzleGenerator.ts` | Test puzzle generation |
| `e2e/helpers/testPuzzleHelpers.ts` | Playwright E2E helpers |
| `src/__tests__/grid/sizing.test.ts` | Grid sizing unit tests |
| `e2e/grid-sizing.spec.ts` | Grid sizing E2E tests |
| `docs/PUZZLE_TESTING.md` | This guide |
