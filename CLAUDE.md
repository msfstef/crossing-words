# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Crossing Words is a cross-platform, peer-to-peer multiplayer crossword application where users can solve crosswords together simultaneously and collaboratively.

## Build & Development Commands

Always try to evaluate your work using the Playwright MCP or Chrome extension for end-to-end testing the web app before asking the human partner for a review.

<!-- TODO: Add build, test, and lint commands once the project structure is established -->

## Architecture

<!-- TODO: Document high-level architecture once implemented -->

## Debugging Approaches

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
