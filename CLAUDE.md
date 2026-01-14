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

**Playwright Browser Isolation**: Always launch Playwright with an isolated browser context to avoid conflicts with other worktrees running tests simultaneously. When using the Playwright MCP, each session automatically gets its own browser instance, but be aware that:
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

### Puzzle Grid Issues

When fixing issues related to the puzzle grid (sizing, layout, rendering), testing can be tricky because puzzles need to be downloaded or imported first.

**Approach: Generate a temporary test puzzle**

1. Create a minimal hardcoded puzzle in the code for testing purposes
2. Use Playwright to interact with it and verify the fix
3. Remove the hardcoded puzzle once the fix is confirmed

Example test puzzle structure:
```typescript
const TEST_PUZZLE: Puzzle = {
  title: "Test Puzzle",
  author: "Debug",
  width: 5,
  height: 5,
  grid: Array.from({ length: 5 }, (_, row) =>
    Array.from({ length: 5 }, (_, col) => ({
      row,
      col,
      letter: "A",
      isBlack: (row === 2 && col === 2), // center black square
      clueNumber: row === 0 && col === 0 ? 1 : undefined,
    }))
  ),
  clues: {
    across: [{ number: 1, direction: "across", text: "Test", row: 0, col: 0, length: 5 }],
    down: [{ number: 1, direction: "down", text: "Test", row: 0, col: 0, length: 5 }],
  },
};
```

You can temporarily inject this in `App.tsx` or the relevant component to bypass the need for downloading/importing during debugging.
