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

**Questions or Issues?** Check existing test files for examples or open an issue.
