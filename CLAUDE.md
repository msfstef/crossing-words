# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Crossing Words is a cross-platform, peer-to-peer multiplayer crossword application where users can solve crosswords together simultaneously and collaboratively.

## Build & Development Commands

**IMPORTANT: Always E2E test your work before requesting review.** Use the Playwright MCP or Chrome extension to verify changes work correctly in the browser.

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

# Run Playwright E2E tests
npx playwright test
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

### Quick Test Puzzle Loading (Dev Mode)

For rapid testing, load test puzzles via URL parameters:

```bash
# Start dev server and open with test puzzle
npm run dev
# Then navigate to: http://localhost:5173?testPuzzle=standard

# Available sizes: mini (5x5), standard (15x15), sunday (21x21), large (25x25)
# Custom size: ?testPuzzle=custom&width=10&height=10
```

**See `docs/PUZZLE_TESTING.md` for comprehensive puzzle testing guide.**

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

**Playwright MCP Browser Isolation**: When using the Playwright MCP tools for browser testing, **ALWAYS use isolated mode**. The default shared browser instance causes "Browser is already in use" errors when multiple agents or worktrees run concurrently.

**CRITICAL**: Use the `mcp__plugin_playwright_playwright__*` tools (e.g., `mcp__plugin_playwright_playwright__browser_navigate`) instead of `mcp__playwright__*` tools. The plugin version runs in isolated mode automatically.

If you encounter "Browser is already in use" errors:
1. Switch to using `mcp__plugin_playwright_playwright__*` tool variants
2. Use `browser_close` to clean up any stale browser instances
3. Verify which port your dev server is running on before navigating
4. Multiple worktrees may be testing the same app on different ports

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

**IMPORTANT: See `docs/PUZZLE_TESTING.md` for comprehensive testing guide including:**
- Test puzzle generator usage and options
- E2E test helpers for Playwright
- Viewport sizes to test
- Testing checklist for puzzle features

#### Quick Reference

```typescript
// Unit tests - import from test puzzle generator
import { createTestPuzzle, TEST_PUZZLES } from '../lib/testPuzzleGenerator';
const puzzle = TEST_PUZZLES.standard; // 15x15

// E2E tests - use helpers
import { navigateToTestPuzzle, waitForPuzzleReady } from './helpers/testPuzzleHelpers';
await navigateToTestPuzzle(page, 'standard');
await waitForPuzzleReady(page);
```

#### Key Test Commands

```bash
# Unit tests for grid sizing
npm run test:run -- src/__tests__/grid

# E2E tests for grid
npx playwright test e2e/grid-sizing.spec.ts
```

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
