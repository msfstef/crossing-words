/**
 * Vitest setup file
 * Runs before all tests to configure the testing environment
 */

import { afterEach, vi } from 'vitest';

// Mock y-webrtc before any tests run
vi.mock('y-webrtc', async () => {
  const mock = await import('./__mocks__/y-webrtc');
  return mock;
});

// Mock console methods to reduce noise in test output
globalThis.console = {
  ...console,
  debug: vi.fn(),
};

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Mock environment variables
vi.stubEnv('VITE_SIGNALING_SERVER', 'ws://test-signaling-server');
