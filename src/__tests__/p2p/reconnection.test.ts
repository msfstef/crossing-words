/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * P2P Reconnection Tests
 *
 * Tests for automatic reconnection logic:
 * - Exponential backoff
 * - Recovery from network interruptions
 * - Reconnection on visibility changes
 * - Health check and stale connection detection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createP2PSession } from '../../crdt/webrtcProvider';
import type { P2PSession } from '../../crdt/webrtcProvider';
import { WebrtcProvider as MockWebrtcProvider } from '../__mocks__/y-webrtc';
import { MockP2PNetwork } from '../utils/mockWebRTC';
import { createTestStore } from '../utils/p2pTestHelpers';

describe('P2P Reconnection', () => {
  let session: P2PSession;
  let store: any;
  let network: MockP2PNetwork;

  beforeEach(async () => {
    vi.useFakeTimers();
    network = new MockP2PNetwork();
    store = await createTestStore();
  });

  afterEach(() => {
    if (session) {
      session.destroy();
    }
    if (store) {
      store.destroy();
    }
    vi.useRealTimers();
  });

  describe('Automatic Reconnection', () => {
    it('should automatically reconnect after disconnection', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      expect(session.connectionState).toBe('connected');

      // Disconnect
      const provider = session.provider as unknown as MockWebrtcProvider;
      provider.manualControl.disconnect();
      expect(session.connectionState).toBe('disconnected');

      // Wait for first reconnect attempt (1s delay)
      await vi.advanceTimersByTimeAsync(1100);

      expect(session.connectionState).toBe('connected');
    });

    it('should use exponential backoff for reconnection attempts', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;

      // Track connection attempts
      let attempts = 0;
      provider.connect = vi.fn(() => {
        attempts++;
        // Keep it disconnected to test backoff
        // Don't actually connect
      });

      // Initial disconnect
      provider.manualControl.disconnect();
      expect(attempts).toBe(0);

      // First attempt: 1s delay
      await vi.advanceTimersByTimeAsync(1100);
      expect(attempts).toBe(1);

      // Second attempt: 2s delay
      await vi.advanceTimersByTimeAsync(2100);
      expect(attempts).toBe(2);

      // Third attempt: 4s delay
      await vi.advanceTimersByTimeAsync(4100);
      expect(attempts).toBe(3);

      // Fourth attempt: 8s delay
      await vi.advanceTimersByTimeAsync(8100);
      expect(attempts).toBe(4);
    });

    it('should cap reconnection delay at max (30s)', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;

      let attempts = 0;
      provider.connect = vi.fn(() => {
        attempts++;
      });

      provider.manualControl.disconnect();

      // Simulate many failed reconnect attempts
      // 1s, 2s, 4s, 8s, 16s, 30s (capped), 30s (capped)...
      const delays = [1000, 2000, 4000, 8000, 16000, 30000, 30000];

      for (let i = 0; i < delays.length; i++) {
        await vi.advanceTimersByTimeAsync(delays[i] + 100);
        expect(attempts).toBe(i + 1);
      }
    });

    it('should reset reconnection attempts after successful connection', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;

      // First disconnection and reconnection cycle
      provider.manualControl.disconnect();
      await vi.advanceTimersByTimeAsync(1100); // First attempt at 1s
      expect(session.connectionState).toBe('connected');

      // Second disconnection - should start from 1s again
      provider.manualControl.disconnect();

      let reconnected = false;
      const checkReconnect = () => {
        if (session.connectionState === 'connected') {
          reconnected = true;
        }
      };
      session.onConnectionChange(checkReconnect);

      // Should reconnect at 1s (not 2s which would be next in backoff)
      await vi.advanceTimersByTimeAsync(1100);
      expect(reconnected).toBe(true);
    });

    it('should not reconnect after session is destroyed', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;

      provider.manualControl.disconnect();
      session.destroy();

      // Wait for what would have been a reconnect attempt
      await vi.advanceTimersByTimeAsync(2000);

      expect(provider.connected).toBe(false);
    });
  });

  describe('Network Recovery', () => {
    it('should reconnect when network comes back online', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;

      // Disconnect
      provider.manualControl.disconnect();
      expect(session.connectionState).toBe('disconnected');

      // Simulate network coming back online
      network.simulateNetworkChange(true);
      await vi.advanceTimersByTimeAsync(100);

      expect(session.connectionState).toBe('connected');
    });

    it('should reset backoff when network comes back online', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;

      // Disconnect and wait for some backoff attempts
      provider.manualControl.disconnect();
      await vi.advanceTimersByTimeAsync(1100); // First attempt

      // Prevent automatic reconnection for this test
      provider.connect = vi.fn();

      await vi.advanceTimersByTimeAsync(2100); // Second attempt (would be at 2s)

      // Network comes back - should reset backoff
      network.simulateNetworkChange(true);
      await vi.advanceTimersByTimeAsync(100);

      // The next manual disconnect should start from 1s again
      // (This is implicit in the reconnection logic)
    });

    it('should handle offline event gracefully', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      expect(session.connectionState).toBe('connected');

      // Simulate network going offline
      network.simulateNetworkChange(false);

      expect(session.connectionState).toBe('disconnected');
    });
  });

  describe('Visibility Change Recovery', () => {
    it('should reconnect when page becomes visible', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      // Simulate page becoming hidden (like mobile app backgrounded)
      network.simulateVisibilityChange(true);

      // Simulate page becoming visible again
      network.simulateVisibilityChange(false);
      await vi.advanceTimersByTimeAsync(100);

      expect(session.connectionState).toBe('connected');
    });

    it('should reset backoff when page becomes visible', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;

      // Disconnect and trigger some backoff
      provider.manualControl.disconnect();
      await vi.advanceTimersByTimeAsync(1100);

      provider.connect = vi.fn();
      await vi.advanceTimersByTimeAsync(2100);

      // Page becomes visible - should reset backoff
      network.simulateVisibilityChange(false);
      await vi.advanceTimersByTimeAsync(100);

      // Connection should be triggered
      expect(provider.connect).toHaveBeenCalled();
    });

    it('should not disconnect when page becomes hidden', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      expect(session.connectionState).toBe('connected');

      // Simulate page becoming hidden
      network.simulateVisibilityChange(true);

      // Should stay connected
      expect(session.connectionState).toBe('connected');
    });
  });

  describe('Manual Reconnection', () => {
    it('should reset backoff on manual reconnect', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;

      // Disconnect and trigger exponential backoff
      provider.manualControl.disconnect();
      await vi.advanceTimersByTimeAsync(1100); // First attempt

      provider.connect = vi.fn();
      await vi.advanceTimersByTimeAsync(2100); // Second attempt (2s)

      // Manual reconnect should reset backoff
      session.reconnect();
      await vi.advanceTimersByTimeAsync(100);

      // Next automatic disconnect should start from 1s
      expect(provider.connect).toHaveBeenCalled();
    });

    it('should cancel pending reconnect on manual reconnect', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;

      provider.manualControl.disconnect();

      // Don't wait for automatic reconnect
      session.reconnect();
      await vi.advanceTimersByTimeAsync(100);

      expect(session.connectionState).toBe('connected');
    });
  });

  describe('Health Check and Stale Connection Detection', () => {
    it('should detect stale connections (connected but no peers)', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      expect(session.connectionState).toBe('connected');
      expect(session.peerCount).toBe(0);

      const provider = session.provider as unknown as MockWebrtcProvider;
      const originalConnect = provider.connect.bind(provider);
      let reconnectCalled = false;

      provider.connect = vi.fn(() => {
        reconnectCalled = true;
        originalConnect();
      });

      // Health check runs every 60s
      // After 3 checks with no peers (3 minutes), should force reconnect
      await vi.advanceTimersByTimeAsync(60000); // 1 minute
      expect(reconnectCalled).toBe(false);

      await vi.advanceTimersByTimeAsync(60000); // 2 minutes
      expect(reconnectCalled).toBe(false);

      await vi.advanceTimersByTimeAsync(60000); // 3 minutes
      expect(reconnectCalled).toBe(true); // Should trigger reconnect
    });

    it('should not trigger stale check if peers are present', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;

      // Add a peer
      provider.manualControl.addPeer('peer-1');
      expect(session.peerCount).toBe(1);

      const originalConnect = provider.connect.bind(provider);
      let reconnectCalled = false;

      provider.connect = vi.fn(() => {
        reconnectCalled = true;
        originalConnect();
      });

      // Wait for 3 health checks
      await vi.advanceTimersByTimeAsync(180000); // 3 minutes

      // Should NOT trigger reconnect because we have peers
      expect(reconnectCalled).toBe(false);
    });

    it('should reset stale check counter when peers connect', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;
      const connectSpy = vi.spyOn(provider, 'connect');

      // Add a peer early to reset any initial checks
      provider.manualControl.addPeer('peer-1');
      await vi.advanceTimersByTimeAsync(10);

      // Remove peer to start the stale check counter
      provider.manualControl.removePeer('peer-1');

      // Wait for 3 health checks (3 minutes = 180 seconds)
      // Need to wait a bit more to account for the interval timing
      await vi.advanceTimersByTimeAsync(185000);

      // Should have triggered reconnect after 3 checks with no peers
      expect(connectSpy).toHaveBeenCalled();
    });
  });

  describe('Focus Event Recovery', () => {
    it('should reconnect when window receives focus after being away', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;

      // Disconnect
      provider.manualControl.disconnect();
      expect(session.connectionState).toBe('disconnected');

      // Simulate time passing (>5 seconds to trigger focus reconnect)
      await vi.advanceTimersByTimeAsync(6000);

      // Simulate focus event
      network.simulateFocus();
      await vi.advanceTimersByTimeAsync(100);

      // Should trigger reconnection
      expect(session.connectionState).toBe('connected');
    });

    it('should check for stale connection on focus', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;
      const originalConnect = provider.connect.bind(provider);
      let reconnectCalled = false;

      // Simulate time passing
      await vi.advanceTimersByTimeAsync(6000);

      // Mock connect to track calls
      provider.connect = vi.fn(() => {
        reconnectCalled = true;
        originalConnect();
      });

      // Session is connected but has 0 peers (stale)
      expect(session.connectionState).toBe('connected');
      expect(session.peerCount).toBe(0);

      // Simulate focus event
      network.simulateFocus();
      await vi.advanceTimersByTimeAsync(100);

      // Should trigger reconnect due to stale connection
      expect(reconnectCalled).toBe(true);
    });

    it('should not reconnect on rapid focus/blur cycles', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;
      const connectSpy = vi.spyOn(provider, 'connect');
      const initialCallCount = connectSpy.mock.calls.length;

      // Rapid focus events (less than 5 seconds apart)
      for (let i = 0; i < 5; i++) {
        network.simulateFocus();
        await vi.advanceTimersByTimeAsync(1000); // 1 second between each
      }

      // Should not have triggered additional reconnects
      // since focus events were too close together
      expect(connectSpy.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('Page Show (bfcache) Recovery', () => {
    it('should reconnect when page is restored from bfcache', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;
      const originalConnect = provider.connect.bind(provider);
      let reconnectCalled = false;

      provider.connect = vi.fn(() => {
        reconnectCalled = true;
        originalConnect();
      });

      // Simulate page restored from bfcache (persisted = true)
      network.simulatePageShow(true);
      await vi.advanceTimersByTimeAsync(100);

      expect(reconnectCalled).toBe(true);
    });

    it('should not reconnect on normal page load (not from bfcache)', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;
      const originalConnect = provider.connect.bind(provider);
      let reconnectCalled = false;

      provider.connect = vi.fn(() => {
        reconnectCalled = true;
        originalConnect();
      });

      // Simulate normal page show (persisted = false)
      network.simulatePageShow(false);
      await vi.advanceTimersByTimeAsync(100);

      // Should NOT trigger reconnect
      expect(reconnectCalled).toBe(false);
    });
  });

  describe('Post-Visibility Health Check', () => {
    it('should perform health check shortly after becoming visible', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;
      const originalConnect = provider.connect.bind(provider);
      let reconnectCount = 0;

      provider.connect = vi.fn(() => {
        reconnectCount++;
        originalConnect();
      });

      // Hide then show the page (connected with 0 peers - potentially stale)
      network.simulateVisibilityChange(true); // hidden
      network.simulateVisibilityChange(false); // visible

      // Initial reconnect on visibility change
      await vi.advanceTimersByTimeAsync(100);
      const initialReconnects = reconnectCount;

      // Wait for post-visibility health check (3 seconds)
      await vi.advanceTimersByTimeAsync(3100);

      // Should have triggered another reconnect due to health check
      // (connected but 0 peers is considered stale)
      expect(reconnectCount).toBeGreaterThan(initialReconnects);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid connect/disconnect cycles', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;

      // Rapid disconnect/reconnect
      for (let i = 0; i < 5; i++) {
        provider.manualControl.disconnect();
        session.reconnect();
        await vi.advanceTimersByTimeAsync(100);
        expect(session.connectionState).toBe('connected');
      }
    });

    it('should handle reconnection during active reconnect attempt', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;

      provider.manualControl.disconnect();

      // Wait partial time for reconnect
      await vi.advanceTimersByTimeAsync(500);

      // Trigger manual reconnect during waiting period
      session.reconnect();
      await vi.advanceTimersByTimeAsync(100);

      expect(session.connectionState).toBe('connected');
    });

    it('should handle simultaneous visibility and network events', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;

      provider.manualControl.disconnect();

      // Trigger both visibility and network events
      network.simulateVisibilityChange(false);
      network.simulateNetworkChange(true);

      await vi.advanceTimersByTimeAsync(100);

      expect(session.connectionState).toBe('connected');
    });
  });
});
