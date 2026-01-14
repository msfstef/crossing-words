# Test Suite

Automated tests for Crossing Words P2P functionality.

## Quick Start

```bash
# Run all tests
npm test

# Run only P2P tests
npm run test:p2p

# Run with UI
npm run test:ui
```

## Structure

```
__tests__/
├── __mocks__/
│   └── y-webrtc.ts          # Mock WebRTC provider
├── utils/
│   ├── mockWebRTC.ts        # Network simulation utilities
│   └── p2pTestHelpers.ts    # Test helper functions
├── p2p/
│   ├── connection.test.ts   # Connection lifecycle tests (19 tests)
│   ├── presence.test.ts     # Awareness/presence tests (15 tests)
│   └── reconnection.test.ts # Reconnection logic tests (19 tests)
└── setup.ts                 # Global test setup
```

## Test Coverage

✅ **53 tests total**

- **Connection Tests (19)**
  - Initial connection establishment
  - Disconnection handling
  - Peer discovery and tracking
  - Manual reconnection
  - Visibility change handling
  - Network event handling
  - Session cleanup

- **Presence Tests (15)**
  - Initial presence establishment
  - Presence sync between peers
  - Multi-peer scenarios
  - Presence re-establishment on reconnection
  - Presence during visibility changes
  - Color conflict resolution
  - Awareness cleanup

- **Reconnection Tests (19)**
  - Automatic reconnection
  - Exponential backoff
  - Network recovery
  - Visibility change recovery
  - Manual reconnection
  - Stale connection detection
  - Edge cases (rapid cycles, simultaneous events)

## Documentation

See [docs/P2P_TESTING.md](../../docs/P2P_TESTING.md) for:
- Detailed testing guide
- How to write new tests
- Debugging failed tests
- Common patterns
- Best practices

## Key Features

- **Fast**: Entire suite runs in ~2-3 seconds
- **Isolated**: Each test runs in isolation with fake timers
- **Comprehensive**: Covers all P2P scenarios
- **Maintainable**: Clear patterns and helper functions
- **Debuggable**: UI mode and detailed error messages

## Adding New Tests

1. Choose the appropriate test file based on the feature
2. Follow existing patterns in that file
3. Use test helpers from `utils/p2pTestHelpers.ts`
4. Run tests to verify: `npm run test:p2p`

## Common Commands

```bash
# Run specific test file
npm test -- connection.test.ts

# Run tests matching pattern
npm test -- --grep "reconnection"

# Watch mode (auto-rerun on changes)
npm test

# Coverage report
npm test -- --coverage
```
