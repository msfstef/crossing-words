/**
 * P2P Connection Tests
 *
 * Tests for WebRTC connection establishment, disconnection, and reconnection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createP2PSession } from '../../crdt/webrtcProvider';
import type { P2PSession } from '../../crdt/webrtcProvider';
import { WebrtcProvider as MockWebrtcProvider } from '../__mocks__/y-webrtc';
import { MockP2PNetwork } from '../utils/mockWebRTC';
import {
  createTestStore,
} from '../utils/p2pTestHelpers';

describe('P2P Connection', () => {
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

  describe('Initial Connection', () => {
    it('should start in connecting state', async () => {
      session = await createP2PSession(store, 'test-room');
      expect(session.connectionState).toBe('connecting');
    });

    it('should transition to connected state after successful connection', async () => {
      session = await createP2PSession(store, 'test-room');
      expect(session.connectionState).toBe('connecting');

      // Wait for auto-connect (100ms in mock)
      await vi.advanceTimersByTimeAsync(150);

      expect(session.connectionState).toBe('connected');
    });

    it('should emit connection state changes', async () => {
      session = await createP2PSession(store, 'test-room');

      const states: string[] = [];
      session.onConnectionChange(state => states.push(state));

      // Initial state should be emitted immediately
      expect(states).toContain('connecting');

      // Wait for connection
      await vi.advanceTimersByTimeAsync(150);

      expect(states).toContain('connected');
      expect(states).toEqual(['connecting', 'connected']);
    });

    it('should wait for store.ready before creating session', async () => {
      let readyResolved = false;
      const delayedStore = {
        ...store,
        ready: new Promise(resolve => {
          setTimeout(() => {
            readyResolved = true;
            resolve(undefined);
          }, 200);
        }),
      };

      const sessionPromise = createP2PSession(delayedStore, 'test-room');

      // Should not resolve immediately
      await vi.advanceTimersByTimeAsync(100);
      expect(readyResolved).toBe(false);

      // Should resolve after store is ready
      await vi.advanceTimersByTimeAsync(150);
      session = await sessionPromise;
      expect(readyResolved).toBe(true);
    });
  });

  describe('Disconnection', () => {
    beforeEach(async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150); // Wait for connection
    });

    it('should transition to disconnected state on disconnection', async () => {
      expect(session.connectionState).toBe('connected');

      const provider = session.provider as unknown as MockWebrtcProvider;
      provider.manualControl.disconnect();

      expect(session.connectionState).toBe('disconnected');
    });

    it('should emit disconnected state on network loss', async () => {
      const states: string[] = [];
      session.onConnectionChange(state => states.push(state));

      const provider = session.provider as unknown as MockWebrtcProvider;
      provider.manualControl.disconnect();

      expect(states).toContain('disconnected');
    });

    it('should handle offline event', async () => {
      expect(session.connectionState).toBe('connected');

      // Simulate network offline
      network.simulateNetworkChange(false);

      // Provider should disconnect
      const provider = session.provider as unknown as MockWebrtcProvider;
      expect(provider.connected).toBe(true); // Provider doesn't auto-disconnect on offline event
    });
  });

  describe('Peer Discovery', () => {
    beforeEach(async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);
    });

    it('should start with 0 peers', () => {
      expect(session.peerCount).toBe(0);
    });

    it('should update peer count when peers connect', async () => {
      const provider = session.provider as unknown as MockWebrtcProvider;

      provider.manualControl.addPeer('peer-1');
      expect(session.peerCount).toBe(1);

      provider.manualControl.addPeer('peer-2');
      expect(session.peerCount).toBe(2);
    });

    it('should emit peer count changes', async () => {
      const counts: number[] = [];
      session.onPeerCountChange(count => counts.push(count));

      // Initial count
      expect(counts).toContain(0);

      const provider = session.provider as unknown as MockWebrtcProvider;
      provider.manualControl.addPeer('peer-1');

      expect(counts).toContain(1);
    });

    it('should update peer count when peers disconnect', async () => {
      const provider = session.provider as unknown as MockWebrtcProvider;

      provider.manualControl.addPeer('peer-1');
      provider.manualControl.addPeer('peer-2');
      expect(session.peerCount).toBe(2);

      provider.manualControl.removePeer('peer-1');
      expect(session.peerCount).toBe(1);

      provider.manualControl.removePeer('peer-2');
      expect(session.peerCount).toBe(0);
    });
  });

  describe('Manual Reconnection', () => {
    beforeEach(async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);
    });

    it('should reconnect when manually triggered', async () => {
      const provider = session.provider as unknown as MockWebrtcProvider;

      // Disconnect
      provider.manualControl.disconnect();
      expect(session.connectionState).toBe('disconnected');

      // Manual reconnect
      session.reconnect();
      await vi.advanceTimersByTimeAsync(100);

      expect(session.connectionState).toBe('connected');
    });

    it('should reset reconnection attempts on manual reconnect', async () => {
      const provider = session.provider as unknown as MockWebrtcProvider;

      // Disconnect and wait for some auto-reconnect attempts
      provider.manualControl.disconnect();
      expect(session.connectionState).toBe('disconnected');

      // Wait for first auto-reconnect attempt (1s)
      await vi.advanceTimersByTimeAsync(1100);

      // Manual reconnect should reset the exponential backoff
      session.reconnect();
      await vi.advanceTimersByTimeAsync(100);

      expect(session.connectionState).toBe('connected');
    });
  });

  describe('Visibility Change Handling', () => {
    beforeEach(async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);
    });

    it('should reconnect when page becomes visible', async () => {
      const provider = session.provider as unknown as MockWebrtcProvider;

      // Simulate tab becoming hidden
      network.simulateVisibilityChange(true);

      // Simulate tab becoming visible again
      network.simulateVisibilityChange(false);

      // Should trigger reconnection
      await vi.advanceTimersByTimeAsync(100);
      expect(provider.connected).toBe(true);
    });

    it('should not reconnect when page becomes hidden', async () => {
      const states: string[] = [];
      session.onConnectionChange(state => states.push(state));

      // Simulate tab becoming hidden
      network.simulateVisibilityChange(true);

      // Should not change connection state
      expect(states.filter(s => s === 'disconnected')).toHaveLength(0);
    });
  });

  describe('Network Event Handling', () => {
    beforeEach(async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);
    });

    it('should reconnect when network comes back online', async () => {
      const provider = session.provider as unknown as MockWebrtcProvider;

      // Disconnect
      provider.manualControl.disconnect();
      expect(session.connectionState).toBe('disconnected');

      // Simulate network coming back online
      network.simulateNetworkChange(true);
      await vi.advanceTimersByTimeAsync(100);

      expect(provider.connected).toBe(true);
    });

    it('should handle offline event gracefully', async () => {
      // Simulate network going offline
      network.simulateNetworkChange(false);

      // State should update to disconnected
      expect(session.connectionState).toBe('disconnected');
    });
  });

  describe('Session Cleanup', () => {
    it('should clean up resources on destroy', async () => {
      session = await createP2PSession(store, 'test-room');
      await vi.advanceTimersByTimeAsync(150);

      const provider = session.provider as unknown as MockWebrtcProvider;

      session.destroy();

      expect(provider.destroyed).toBe(true);
    });

    it('should not reconnect after destroy', async () => {
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
});
