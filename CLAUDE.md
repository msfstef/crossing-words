# CLAUDE.md

## Project Overview

Crossing Words is a cross-platform, peer-to-peer multiplayer crossword application for collaborative solving.

## Commands

```bash
npm run dev      # Start dev server (use the port it assigns)
npm run build    # Production build
npm run lint     # Lint code
npm test         # Run unit tests (watch mode)
npm run test:run # Run unit tests once
npm run test:p2p # P2P-specific tests
npx playwright test # E2E tests (when needed)
```

## Testing Philosophy

**Prefer unit tests with React Testing Library** for fast feedback. Only use Playwright E2E tests when verifying actual browser rendering behavior.

### Test Puzzles

Load test puzzles via URL params in dev mode:
```
http://localhost:<port>?testPuzzle=standard   # 15x15
http://localhost:<port>?testPuzzle=mini       # 5x5
http://localhost:<port>?testPuzzle=sunday     # 21x21
http://localhost:<port>?testPuzzle=custom&width=10&height=10
```

In unit tests:
```typescript
import { createTestPuzzle, TEST_PUZZLES } from '../lib/testPuzzleGenerator';
const puzzle = TEST_PUZZLES.standard;
```

### Collaboration UI Testing

Use `MockAwareness` for testing hooks/components without network:

```typescript
import { MockAwareness, simulateCollaboratorJoin } from '../__tests__/utils/collaborationTestHelpers';

const awareness = new MockAwareness();
simulateCollaboratorJoin(awareness, { name: 'Alice', cursor: { row: 0, col: 0, direction: 'across' } });
```

## Debugging Guides

- **P2P issues**: See `docs/P2P_TESTING.md`
- **Puzzle/grid testing**: See `docs/PUZZLE_TESTING.md`
