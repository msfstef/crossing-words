# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Crossing Words is a cross-platform, peer-to-peer multiplayer crossword application where users can solve crosswords together simultaneously and collaboratively.

## Build & Development Commands

Always try to evaluate your work using the Playwright MCP or Chrome extension for end-to-end testing the web app before asking the human partner for a review.

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test

# Run tests once and exit
npm run test:run

# Run only P2P tests
npm run test:p2p

# Run tests with UI
npm run test:ui
```

### Other Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint
```

### Worktree Isolation

When working in a git worktree, other worktrees may be running dev servers or Playwright tests concurrently. To avoid conflicts:

**Dev Server Port**: Before starting a dev server, check if the default port (usually 5173 for Vite) is already in use:
```bash
lsof -i :5173
```
If occupied, use a different port:
```bash
npm run dev -- --port 5174  # or any available port
```

**Playwright MCP Browser Isolation**: When using the Playwright MCP tools for browser testing, **always run in isolated mode** to avoid conflicts with other worktrees or agents running tests simultaneously. The default browser instance is shared and will cause "Browser is already in use" errors.

To enable isolated mode, configure the MCP server with `--isolated` flag. If you encounter browser conflicts:
- Multiple worktrees may be testing the same app on different ports
- Always verify which port your dev server is running on before navigating
- Use `browser_close` to clean up browser instances when done testing

**Quick port availability check**:
```bash
# Find all dev servers running in worktrees
lsof -i :5173-5180 | grep LISTEN
```

## Architecture

<!-- TODO: Document high-level architecture once implemented -->

## Debugging Approaches

### P2P Connectivity Issues

When debugging P2P (peer-to-peer) connection issues, use the automated test suite first:

**Approach: Use the P2P Test Suite**

1. Run the P2P tests to verify the issue: `npm run test:p2p`
2. Write a new test that reproduces the issue
3. Fix the issue and verify with tests
4. See `docs/P2P_TESTING.md` for detailed testing guide

The P2P test suite covers:
- Connection establishment and lifecycle
- Disconnection and automatic reconnection
- Presence tracking via Yjs Awareness
- Network interruption recovery
- Stale connection detection
- Exponential backoff logic

**Common P2P Issues:**

- **Idle tabs losing connection**: Tested in `reconnection.test.ts` visibility change tests
- **Failed reconnections**: Tested in `reconnection.test.ts` exponential backoff tests
- **Presence not established**: Tested in `presence.test.ts` presence establishment tests
- **Peers disappearing**: Tested in `presence.test.ts` and `connection.test.ts` peer tracking tests

### UI Layout and Rendering Issues

When fixing UI issues related to layout, sizing, or rendering, **both** types of tests are required:

**1. Unit tests (Vitest + happy-dom):** Test calculation logic and component rendering with mocked dimensions
**2. E2E tests (Playwright):** Test actual rendering at various viewport sizes

#### Test Puzzle Generator

Use `src/lib/testPuzzleGenerator.ts` for testing different puzzle sizes:

```typescript
import { createTestPuzzle, TEST_PUZZLES } from '../lib/testPuzzleGenerator';

// Create custom size puzzle
const puzzle = createTestPuzzle({ width: 21, height: 21 });

// Or use pre-defined sizes
const miniPuzzle = TEST_PUZZLES.mini;       // 5x5
const standardPuzzle = TEST_PUZZLES.standard; // 15x15
const sundayPuzzle = TEST_PUZZLES.sunday;     // 21x21
const largePuzzle = TEST_PUZZLES.large;       // 25x25
```

#### Grid Sizing Tests

Grid cell sizing logic is in `src/components/CrosswordGrid.tsx`. The key functions are:
- `calculateCellSize()` - Calculates optimal cell size for given container and puzzle dimensions
- `getInitialCellSize()` - Estimates cell size from viewport before ResizeObserver kicks in

Unit tests are in `src/__tests__/grid/sizing.test.ts`. Run with:
```bash
npm run test:run -- src/__tests__/grid
```

E2E tests are in `e2e/grid-sizing.spec.ts`. Run with:
```bash
npx playwright test e2e/grid-sizing.spec.ts
```

#### Viewport Sizes to Test

When testing UI layout, cover these common device sizes:
- Mobile portrait: 375x667 (iPhone 8)
- Mobile small: 320x568 (iPhone SE)
- Tablet: 768x1024 (iPad)
- Desktop: 1920x1080

#### Puzzle Grid Layout Structure

The puzzle grid uses a structured layout to ensure proper sizing:

```
.solve-layout__grid (flex: 1)
  └── .puzzle-grid-area (flex: 1, column)
        ├── .puzzle-grid-header (flex: 0 0 auto)
        │     ├── .puzzle-title-above-grid
        │     └── .puzzle-author
        └── .puzzle-grid-wrapper (flex: 1, min-height: 0)
              └── CrosswordGrid (100% width/height)
```

This structure ensures:
- Title/author take only their natural height
- Grid wrapper fills remaining space
- ResizeObserver gets accurate measurements for cell sizing
