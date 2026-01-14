# P2P Testing Guide

This document describes the P2P (peer-to-peer) testing framework for Crossing Words, including how to run tests, write new tests, and debug P2P issues.

## Overview

The P2P testing framework provides automated testing for WebRTC-based collaboration features:
- Connection establishment and lifecycle
- Disconnection and automatic reconnection
- Presence tracking via Yjs Awareness
- Network interruption recovery
- Stale connection detection
- Exponential backoff reconnection logic

## Quick Start

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test

# Run tests once and exit
npm run test:run

# Run only P2P tests
npm run test:p2p

# Run tests with UI (opens browser interface)
npm run test:ui
```

### Test Output

```bash
✓ src/__tests__/p2p/connection.test.ts (19 tests)
✓ src/__tests__/p2p/presence.test.ts (15 tests)
✓ src/__tests__/p2p/reconnection.test.ts (19 tests)

Test Files  3 passed (3)
     Tests  53 passed (53)
```

## Architecture

### Test Structure

```
src/__tests__/
├── __mocks__/
│   └── y-webrtc.ts          # Mock WebRTC provider
├── utils/
│   ├── mockWebRTC.ts        # Network simulation utilities
│   └── p2pTestHelpers.ts    # Test helper functions
├── p2p/
│   ├── connection.test.ts   # Connection lifecycle tests
│   ├── presence.test.ts     # Awareness/presence tests
│   └── reconnection.test.ts # Reconnection logic tests
└── setup.ts                 # Global test setup
```

### Mock System

The testing framework uses a mock WebRTC provider that simulates real P2P behavior:

1. **Mock WebRTC Provider** (`src/__tests__/__mocks__/y-webrtc.ts`)
   - Simulates WebrtcProvider from y-webrtc
   - Provides manual control over connection states
   - Emits proper events for testing

2. **Mock P2P Network** (`src/__tests__/utils/mockWebRTC.ts`)
   - Simulates multiple peers in a network
   - Controls peer connections and disconnections
   - Simulates network events (online/offline)
   - Simulates visibility changes (tab hidden/shown)

3. **Test Helpers** (`src/__tests__/utils/p2pTestHelpers.ts`)
   - Create test stores and sessions
   - Wait for connection states
   - Query awareness states
   - Set up multi-peer scenarios

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createP2PSession } from '../../crdt/webrtcProvider';
import { WebrtcProvider as MockWebrtcProvider } from '../__mocks__/y-webrtc';
import { MockP2PNetwork } from '../utils/mockWebRTC';
import { createTestStore } from '../utils/p2pTestHelpers';

describe('My P2P Feature', () => {
  let session;
  let store;
  let network;

  beforeEach(async () => {
    vi.useFakeTimers();
    network = new MockP2PNetwork();
    store = await createTestStore();
  });

  afterEach(() => {
    if (session) session.destroy();
    if (store) store.destroy();
    vi.useRealTimers();
  });

  it('should do something', async () => {
    session = await createP2PSession(store, 'test-room');

    // Wait for initial connection
    await vi.advanceTimersByTimeAsync(150);

    expect(session.connectionState).toBe('connected');
  });
});
```

### Simulating Network Events

```typescript
// Simulate network going offline
network.simulateNetworkChange(false);

// Simulate network coming back online
network.simulateNetworkChange(true);

// Simulate tab becoming hidden
network.simulateVisibilityChange(true);

// Simulate tab becoming visible
network.simulateVisibilityChange(false);
```

### Simulating Peer Connections

```typescript
// Create two peers
const store1 = await createTestStore('puzzle-1');
const store2 = await createTestStore('puzzle-2');
const session1 = await createP2PSession(store1, 'test-room');
const session2 = await createP2PSession(store2, 'test-room');

// Wait for initial connection
await vi.advanceTimersByTimeAsync(150);

// Register providers with network
network.registerProvider(session1.provider);
network.registerProvider(session2.provider);

// Connect the peers
network.connectPeers(session1.provider, session2.provider);

// Verify they see each other
expect(getCollaboratorCount(session1)).toBe(1);
expect(getCollaboratorCount(session2)).toBe(1);
```

### Manual Provider Control

```typescript
const provider = session.provider as unknown as MockWebrtcProvider;

// Manually trigger connection
provider.manualControl.connect();

// Manually trigger disconnection
provider.manualControl.disconnect();

// Add a simulated peer
provider.manualControl.addPeer('peer-1');

// Remove a simulated peer
provider.manualControl.removePeer('peer-1');
```

### Testing Presence

```typescript
import {
  getCollaboratorCount,
  hasAwarenessClient,
  getAwarenessState,
} from '../utils/p2pTestHelpers';

// Check number of collaborators (excluding self)
const count = getCollaboratorCount(session);

// Check if specific client is present
const isPresent = hasAwarenessClient(session, clientId);

// Get awareness state for a client
const state = getAwarenessState(session, clientId);
expect(state.user.name).toBeDefined();
expect(state.user.color).toBeDefined();
```

### Timing Control

Tests use fake timers for precise control:

```typescript
// Advance time by specific amount
await vi.advanceTimersByTimeAsync(1000); // 1 second

// Example: Test reconnection after 3 minutes
await vi.advanceTimersByTimeAsync(180000); // 3 minutes
```

## Common Test Patterns

### Testing Reconnection Logic

```typescript
it('should reconnect after disconnection', async () => {
  session = await createP2PSession(store, 'test-room');
  await vi.advanceTimersByTimeAsync(150);

  const provider = session.provider as unknown as MockWebrtcProvider;

  // Disconnect
  provider.manualControl.disconnect();
  expect(session.connectionState).toBe('disconnected');

  // Wait for auto-reconnect (1 second with exponential backoff)
  await vi.advanceTimersByTimeAsync(1100);

  expect(session.connectionState).toBe('connected');
});
```

### Testing Presence Establishment

```typescript
it('should establish presence on join', async () => {
  session = await createP2PSession(store, 'test-room');
  await vi.advanceTimersByTimeAsync(50);

  const localState = session.awareness.getLocalState();
  expect(localState.user.name).toBeDefined();
  expect(localState.user.color).toBeDefined();
  expect(localState.cursor).toBeNull();
});
```

### Testing Network Recovery

```typescript
it('should recover from network interruption', async () => {
  session = await createP2PSession(store, 'test-room');
  await vi.advanceTimersByTimeAsync(150);

  // Simulate network offline
  network.simulateNetworkChange(false);
  expect(session.connectionState).toBe('disconnected');

  // Simulate network coming back
  network.simulateNetworkChange(true);
  await vi.advanceTimersByTimeAsync(100);

  expect(session.connectionState).toBe('connected');
});
```

## Debugging Failed Tests

### Enable Console Logging

Edit `src/__tests__/setup.ts` to see debug logs:

```typescript
// Comment out console mocking to see logs
// global.console = {
//   ...console,
//   debug: vi.fn(),
// };
```

### Use Test UI

```bash
npm run test:ui
```

This opens a browser interface where you can:
- See test results in real-time
- Inspect test output and errors
- Re-run specific tests
- Debug with breakpoints

### Common Issues

#### Test Timeout
If tests timeout, increase the timeout in `vitest.config.ts`:

```typescript
test: {
  testTimeout: 10000, // 10 seconds
}
```

#### Timing Issues
Use `vi.advanceTimersByTimeAsync()` instead of real waits:

```typescript
// ❌ Don't use real timeouts
await new Promise(resolve => setTimeout(resolve, 1000));

// ✅ Use fake timers
await vi.advanceTimersByTimeAsync(1000);
```

#### Awareness State Not Updating
Make sure to wait for async operations:

```typescript
network.connectPeers(provider1, provider2);
// Give time for awareness to sync
await vi.advanceTimersByTimeAsync(10);
expect(getCollaboratorCount(session1)).toBe(1);
```

## Extending the Test Suite

### Adding New Test Cases

1. **Identify the scenario**: What P2P behavior needs testing?
2. **Choose the right test file**:
   - `connection.test.ts` - Connection lifecycle, peer discovery
   - `presence.test.ts` - Awareness, user state, presence sync
   - `reconnection.test.ts` - Reconnection logic, error recovery

3. **Write the test** following existing patterns
4. **Verify it fails first** (test the test!)
5. **Implement the fix** if testing a bug
6. **Verify it passes**

### Example: Testing a New Feature

```typescript
// In connection.test.ts
describe('Custom Connection Feature', () => {
  it('should handle custom scenario', async () => {
    session = await createP2PSession(store, 'test-room');
    await vi.advanceTimersByTimeAsync(150);

    // Test your feature
    const result = session.someNewFeature();
    expect(result).toBe(expectedValue);
  });
});
```

## Performance Considerations

- Tests run in parallel by default
- Each test file runs in isolation
- Mock providers are lightweight
- Fake timers make tests fast (no real waiting)

Total test suite runs in ~2-3 seconds for 53 tests.

## Integration with CI/CD

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run P2P Tests
  run: npm run test:run
```

## Best Practices

1. **Always use fake timers** for time-dependent tests
2. **Clean up resources** in `afterEach`
3. **Test one thing per test** - keep tests focused
4. **Use descriptive test names** - "should X when Y"
5. **Avoid brittle timing** - use generous buffers
6. **Test edge cases** - rapid connections, network flaps, etc.
7. **Keep tests independent** - no shared state between tests

## Test Coverage

Current coverage:
- ✅ Connection establishment (19 tests)
- ✅ Presence tracking (15 tests)
- ✅ Reconnection logic (19 tests)
- ✅ Network event handling
- ✅ Visibility change handling
- ✅ Exponential backoff
- ✅ Stale connection detection
- ✅ Multi-peer scenarios

## Troubleshooting P2P Issues

When you encounter P2P issues in production:

1. **Reproduce with tests**: Write a test that reproduces the issue
2. **Isolate the problem**: Which component is failing?
3. **Check timing**: Are there race conditions?
4. **Verify presence**: Is awareness properly synced?
5. **Check reconnection**: Is exponential backoff working?

Example debugging workflow:

```typescript
it('reproduces production bug', async () => {
  // Set up scenario that matches production
  session = await createP2PSession(store, 'test-room');
  await vi.advanceTimersByTimeAsync(150);

  // Reproduce the issue
  // ... simulate the problem

  // Add assertions to understand what's happening
  console.log('Connection state:', session.connectionState);
  console.log('Peer count:', session.peerCount);
  console.log('Awareness states:', session.awareness.getStates());
});
```

## Future Improvements

Potential areas for expansion:
- Test puzzle sync between peers
- Test cursor following logic
- Test color conflict resolution more thoroughly
- Add performance benchmarks
- Test with more than 2-3 peers
- Test WebRTC signaling server integration
- Add visual regression testing for multiplayer UI

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [y-webrtc Documentation](https://github.com/yjs/y-webrtc)
- [Yjs Awareness Protocol](https://docs.yjs.dev/api/about-awareness)
- [WebRTC Testing Best Practices](https://webrtc.org/getting-started/testing)

---

# Collaboration UI Testing

This section covers testing collaboration UI components and hooks **without network connectivity**. Use these utilities when implementing or modifying collaboration UI features.

## Overview

The collaboration UI test infrastructure provides:
- **MockAwareness** - A standalone Yjs Awareness mock for testing hooks and components
- **Test Helpers** - Utilities for creating mock collaborators and simulating collaboration flows
- **Scenario Builders** - Pre-built setups for common collaboration scenarios

## Quick Start

### Running Collaboration UI Tests

```bash
# Run collaboration UI tests
npm run test:run -- src/__tests__/collaboration/

# Run a specific test file
npm run test:run -- src/__tests__/collaboration/collaborationUI.test.ts
```

### Basic Test Setup

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCollaborators } from '../../collaboration/useCollaborators';
import {
  MockAwareness,
  simulateCollaboratorJoin,
  simulateCollaboratorLeave,
  simulateCursorMove,
  resetClientIdCounter,
} from '../utils/collaborationTestHelpers';

describe('My Collaboration Feature', () => {
  let awareness: MockAwareness;

  beforeEach(() => {
    resetClientIdCounter(); // Ensures predictable client IDs
    awareness = new MockAwareness();
  });

  it('should react to collaborator joining', () => {
    const { result } = renderHook(() => useCollaborators(awareness));

    act(() => {
      simulateCollaboratorJoin(awareness, { name: 'Alice' });
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0].user.name).toBe('Alice');
  });
});
```

## Test Utilities

### MockAwareness

A mock implementation of Yjs Awareness that doesn't require network connectivity.

```typescript
import { MockAwareness } from '../utils/collaborationTestHelpers';

// Create with default local client ID (1)
const awareness = new MockAwareness();

// Create with custom local client ID
const awareness = new MockAwareness(42);

// Set local user state
awareness.setLocalState({
  user: { name: 'Me', color: '#4F46E5' },
  cursor: { row: 0, col: 0, direction: 'across' },
});

// Get all states (matches real Awareness API)
const states = awareness.getStates();
```

#### Test Helper Methods

MockAwareness provides additional methods for testing:

```typescript
// Add a collaborator (simulates remote user joining)
awareness.addCollaborator({
  clientId: 2,
  user: { name: 'Alice', color: '#ff6b6b' },
  cursor: { row: 5, col: 3, direction: 'across' },
});

// Remove a collaborator (simulates user leaving)
awareness.removeCollaborator(2);

// Update collaborator cursor
awareness.updateCollaboratorCursor(2, { row: 10, col: 7, direction: 'down' });

// Get specific collaborator state
const state = awareness.getCollaboratorState(2);

// Get all collaborator IDs (excluding local)
const ids = awareness.getCollaboratorIds();

// Clear all collaborators
awareness.clearCollaborators();

// Reset entire awareness state
awareness.reset();
```

### Simulation Helpers

Helper functions for common collaboration actions:

```typescript
import {
  simulateCollaboratorJoin,
  simulateCollaboratorLeave,
  simulateCursorMove,
  simulateTyping,
  simulateMultipleJoins,
} from '../utils/collaborationTestHelpers';

// Simulate collaborator joining with options
const clientId = simulateCollaboratorJoin(awareness, {
  name: 'Alice',
  cursor: { row: 0, col: 0, direction: 'across' },
});

// Simulate collaborator leaving
simulateCollaboratorLeave(awareness, clientId);

// Simulate cursor movement
simulateCursorMove(awareness, clientId, { row: 5, col: 3, direction: 'down' });

// Simulate typing (advances cursor in current direction)
simulateTyping(awareness, clientId);

// Simulate multiple users joining at once
const clientIds = simulateMultipleJoins(awareness, 5);
```

### Mock Data Generators

Create mock collaborators with sensible defaults:

```typescript
import {
  createMockCollaborator,
  createMockCollaborators,
  generateClientId,
  getMockName,
  getCollaboratorColor,
} from '../utils/collaborationTestHelpers';

// Create a single mock collaborator
const alice = createMockCollaborator({
  name: 'Alice',
  cursor: { row: 5, col: 3, direction: 'across' },
});

// Create with all defaults (auto-generated name, color, clientId)
const collaborator = createMockCollaborator();

// Create multiple collaborators
const collaborators = createMockCollaborators(5, {
  cursor: { row: 0, col: 0, direction: 'across' },
});
```

### State Verification Helpers

Helpers for asserting collaboration state:

```typescript
import {
  getCollaboratorCount,
  hasCollaborator,
  getCollaboratorCursor,
  hasCollaboratorAtPosition,
  getCollaboratorsAtPosition,
} from '../utils/collaborationTestHelpers';

// Get number of collaborators (excluding local)
const count = getCollaboratorCount(awareness);

// Check if specific collaborator exists
const exists = hasCollaborator(awareness, clientId);

// Get a collaborator's cursor position
const cursor = getCollaboratorCursor(awareness, clientId);

// Check if any collaborator is at a position
const atCell = hasCollaboratorAtPosition(awareness, { row: 5, col: 3 });

// Get all collaborators at a position
const atPosition = getCollaboratorsAtPosition(awareness, { row: 5, col: 3 });
```

## Scenario Builders

Pre-built setups for common testing scenarios:

### Basic Collaboration Scenario

```typescript
import { setupCollaborationScenario } from '../utils/collaborationTestHelpers';

const awareness = setupCollaborationScenario({
  localUser: { name: 'Me', color: '#4F46E5' },
  localCursor: { row: 0, col: 0, direction: 'across' },
  collaborators: [
    { name: 'Alice', cursor: { row: 5, col: 5, direction: 'across' } },
    { name: 'Bob', cursor: { row: 10, col: 10, direction: 'down' } },
  ],
});
```

### Overlapping Cursors Scenario

Test multiple cursors on the same cell:

```typescript
import { setupOverlappingCursors } from '../utils/collaborationTestHelpers';

// 3 collaborators all at position (5, 3)
const awareness = setupOverlappingCursors({ row: 5, col: 3 }, 3);

// Verify
const atPosition = getCollaboratorsAtPosition(awareness, { row: 5, col: 3 });
expect(atPosition).toHaveLength(3);
```

### Follow Mode Scenario

Test cursor following behavior:

```typescript
import { setupFollowScenario } from '../utils/collaborationTestHelpers';

const { awareness, leaderId, followerIds } = setupFollowScenario({
  leader: {
    name: 'Leader',
    cursor: { row: 0, col: 0, direction: 'across' },
  },
  followerCount: 2,
});

// Verify followers are following the leader
for (const followerId of followerIds) {
  const state = awareness.getCollaboratorState(followerId);
  expect(state?.followingClientId).toBe(leaderId);
}
```

## Common Test Patterns

### Testing Hook Reactivity

```typescript
it('should update when collaborator cursor moves', () => {
  const { result } = renderHook(() => useCollaborators(awareness));

  let clientId: number;
  act(() => {
    clientId = simulateCollaboratorJoin(awareness, {
      cursor: { row: 0, col: 0, direction: 'across' },
    });
  });

  expect(result.current[0].cursor?.row).toBe(0);

  act(() => {
    simulateCursorMove(awareness, clientId!, { row: 5, col: 3, direction: 'down' });
  });

  expect(result.current[0].cursor?.row).toBe(5);
  expect(result.current[0].cursor?.col).toBe(3);
});
```

### Testing Component Rendering

```typescript
import { render, screen } from '@testing-library/react';
import { CollaboratorCursors } from '../../components/CollaboratorCursors';

it('should render collaborator cursors', () => {
  const awareness = setupCollaborationScenario({
    collaborators: [
      { name: 'Alice', cursor: { row: 0, col: 0, direction: 'across' } },
    ],
  });

  render(<CollaboratorCursors awareness={awareness} />);

  expect(screen.getByText('Alice')).toBeInTheDocument();
});
```

### Testing Collaboration Events

```typescript
it('should notify on collaborator join', () => {
  const notify = vi.fn();
  const { result } = renderHook(() =>
    useCollaborators(awareness, { notify })
  );

  // First join after initial load
  act(() => {
    simulateCollaboratorJoin(awareness, { name: 'Alice' });
  });

  // Trigger another join to trigger notification
  act(() => {
    simulateCollaboratorJoin(awareness, { name: 'Bob' });
  });

  expect(notify).toHaveBeenCalledWith('Bob joined', expect.any(Object));
});
```

### Testing Async Scenarios

```typescript
import { waitForCollaboratorCount } from '../utils/collaborationTestHelpers';

it('should wait for expected collaborator count', async () => {
  const awareness = new MockAwareness();

  // Simulate delayed joins
  setTimeout(() => simulateCollaboratorJoin(awareness, {}), 100);
  setTimeout(() => simulateCollaboratorJoin(awareness, {}), 200);

  // Wait for both to join
  await waitForCollaboratorCount(awareness, 2, 500);

  expect(getCollaboratorCount(awareness)).toBe(2);
});
```

## When to Use Each Approach

| Scenario | Approach |
|----------|----------|
| Testing hooks (useCollaborators, etc.) | MockAwareness + renderHook |
| Testing UI components | MockAwareness + render |
| Testing cursor interactions | simulateCursorMove + simulateTyping |
| Testing presence flows | simulateCollaboratorJoin/Leave |
| Testing overlapping cursors | setupOverlappingCursors |
| Testing follow mode | setupFollowScenario |
| Full P2P integration | Use P2P test infrastructure |

## File Structure

```
src/__tests__/
├── utils/
│   ├── MockAwareness.ts           # Mock Yjs Awareness implementation
│   ├── collaborationTestHelpers.ts # Helper functions and scenarios
│   └── p2pTestHelpers.ts          # Full P2P test helpers
├── collaboration/
│   └── collaborationUI.test.ts    # Example collaboration UI tests
└── p2p/
    └── ...                        # Full P2P integration tests
```

## Best Practices

1. **Use MockAwareness for unit tests** - Fast, isolated, no network
2. **Reset client ID counter** in `beforeEach` for predictable IDs
3. **Use `act()` wrapper** when simulating state changes in hook tests
4. **Test both join and leave flows** - Ensure proper cleanup
5. **Test edge cases** - Overlapping cursors, rapid join/leave, etc.
6. **Keep tests focused** - One scenario per test
7. **Use scenario builders** for complex setups
8. **Verify state after actions** - Don't assume state changes happened

## Troubleshooting

### Hook Not Updating

Ensure state changes are wrapped in `act()`:

```typescript
// ❌ Wrong
simulateCollaboratorJoin(awareness, { name: 'Alice' });

// ✅ Correct
act(() => {
  simulateCollaboratorJoin(awareness, { name: 'Alice' });
});
```

### Client ID Collisions

Reset the counter between tests:

```typescript
beforeEach(() => {
  resetClientIdCounter();
});
```

### Local User Appearing in Collaborators

Ensure hooks filter out the local client ID. Check that `awareness.clientID` matches what you expect.

---

**Questions or Issues?** Check existing test files for examples or open an issue.
