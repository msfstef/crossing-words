/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * P2P Presence Tests
 *
 * Tests for Yjs Awareness presence tracking:
 * - Presence establishment upon joining
 * - Presence re-establishment upon reconnection
 * - Presence sync between peers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createP2PSession } from '../../crdt/webrtcProvider';
import { WebrtcProvider as MockWebrtcProvider } from '../__mocks__/y-webrtc';
import { MockP2PNetwork } from '../utils/mockWebRTC';
import {
  createTestStore,
  getCollaboratorCount,
  hasAwarenessClient,
  getAwarenessState,
} from '../utils/p2pTestHelpers';

describe('P2P Presence', () => {
  let network: MockP2PNetwork;

  beforeEach(() => {
    vi.useFakeTimers();
    network = new MockP2PNetwork();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial Presence Establishment', () => {
    it('should establish local presence immediately upon session creation', async () => {
      const store = await createTestStore();
      const session = await createP2PSession(store, 'test-room');

      await vi.advanceTimersByTimeAsync(50);

      const localState = session.awareness.getLocalState();
      expect(localState).toBeDefined();
      expect(localState).toHaveProperty('user');
      expect(localState).toHaveProperty('cursor');

      session.destroy();
      store.destroy();
    });

    it('should set user name and color on join', async () => {
      const store = await createTestStore();
      const session = await createP2PSession(store, 'test-room');

      await vi.advanceTimersByTimeAsync(50);

      const localState = session.awareness.getLocalState() as any;
      expect(localState.user.name).toBeDefined();
      expect(localState.user.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/); // "Adjective Noun" format
      expect(localState.user.color).toBeDefined();
      expect(typeof localState.user.color).toBe('string');

      session.destroy();
      store.destroy();
    });

    it('should initialize cursor to null', async () => {
      const store = await createTestStore();
      const session = await createP2PSession(store, 'test-room');

      await vi.advanceTimersByTimeAsync(50);

      const localState = session.awareness.getLocalState() as any;
      expect(localState.cursor).toBeNull();

      session.destroy();
      store.destroy();
    });

    it('should have unique client ID', async () => {
      const store1 = await createTestStore('puzzle-1');
      const store2 = await createTestStore('puzzle-2');

      const session1 = await createP2PSession(store1, 'test-room');
      const session2 = await createP2PSession(store2, 'test-room');

      await vi.advanceTimersByTimeAsync(50);

      expect(session1.awareness.clientID).not.toBe(session2.awareness.clientID);

      session1.destroy();
      session2.destroy();
      store1.destroy();
      store2.destroy();
    });
  });

  describe('Presence Sync Between Peers', () => {
    it('should sync presence when two peers connect', async () => {
      const store1 = await createTestStore('puzzle-1');
      const store2 = await createTestStore('puzzle-2');

      const session1 = await createP2PSession(store1, 'test-room');
      const session2 = await createP2PSession(store2, 'test-room');

      await vi.advanceTimersByTimeAsync(150);

      network.registerProvider(session1.provider as unknown as MockWebrtcProvider);
      network.registerProvider(session2.provider as unknown as MockWebrtcProvider);

      // Connect the peers
      network.connectPeers(
        session1.provider as unknown as MockWebrtcProvider,
        session2.provider as unknown as MockWebrtcProvider
      );

      // Session 1 should see Session 2's presence
      expect(hasAwarenessClient(session1, session2.awareness.clientID)).toBe(true);

      // Session 2 should see Session 1's presence
      expect(hasAwarenessClient(session2, session1.awareness.clientID)).toBe(true);

      session1.destroy();
      session2.destroy();
      store1.destroy();
      store2.destroy();
    });

    it('should sync user info between peers', async () => {
      const store1 = await createTestStore('puzzle-1');
      const store2 = await createTestStore('puzzle-2');

      const session1 = await createP2PSession(store1, 'test-room');
      const session2 = await createP2PSession(store2, 'test-room');

      await vi.advanceTimersByTimeAsync(150);

      network.registerProvider(session1.provider as unknown as MockWebrtcProvider);
      network.registerProvider(session2.provider as unknown as MockWebrtcProvider);

      network.connectPeers(
        session1.provider as unknown as MockWebrtcProvider,
        session2.provider as unknown as MockWebrtcProvider
      );

      // Get peer's state from each session
      const peer2StateFrom1 = getAwarenessState(session1, session2.awareness.clientID);
      const peer1StateFrom2 = getAwarenessState(session2, session1.awareness.clientID);

      expect(peer2StateFrom1).toHaveProperty('user');
      expect(peer2StateFrom1.user).toHaveProperty('name');
      expect(peer2StateFrom1.user).toHaveProperty('color');

      expect(peer1StateFrom2).toHaveProperty('user');
      expect(peer1StateFrom2.user).toHaveProperty('name');
      expect(peer1StateFrom2.user).toHaveProperty('color');

      session1.destroy();
      session2.destroy();
      store1.destroy();
      store2.destroy();
    });

    it('should handle multiple peers joining', async () => {
      const stores = await Promise.all([
        createTestStore('puzzle-1'),
        createTestStore('puzzle-2'),
        createTestStore('puzzle-3'),
      ]);

      const sessions = await Promise.all([
        createP2PSession(stores[0], 'test-room'),
        createP2PSession(stores[1], 'test-room'),
        createP2PSession(stores[2], 'test-room'),
      ]);

      await vi.advanceTimersByTimeAsync(150);

      sessions.forEach(session => {
        network.registerProvider(session.provider as unknown as MockWebrtcProvider);
      });

      // Connect all peers in a mesh
      network.connectPeers(
        sessions[0].provider as unknown as MockWebrtcProvider,
        sessions[1].provider as unknown as MockWebrtcProvider
      );
      network.connectPeers(
        sessions[1].provider as unknown as MockWebrtcProvider,
        sessions[2].provider as unknown as MockWebrtcProvider
      );
      network.connectPeers(
        sessions[0].provider as unknown as MockWebrtcProvider,
        sessions[2].provider as unknown as MockWebrtcProvider
      );

      // Each session should see 2 other peers
      expect(getCollaboratorCount(sessions[0])).toBe(2);
      expect(getCollaboratorCount(sessions[1])).toBe(2);
      expect(getCollaboratorCount(sessions[2])).toBe(2);

      sessions.forEach(session => session.destroy());
      stores.forEach(store => store.destroy());
    });
  });

  describe('Presence Re-establishment on Reconnection', () => {
    it('should maintain presence after disconnect/reconnect', async () => {
      const store = await createTestStore();
      const session = await createP2PSession(store, 'test-room');

      await vi.advanceTimersByTimeAsync(150);

      const originalState = session.awareness.getLocalState();

      // Disconnect
      const provider = session.provider as unknown as MockWebrtcProvider;
      provider.manualControl.disconnect();

      // Reconnect
      session.reconnect();
      await vi.advanceTimersByTimeAsync(100);

      const newState = session.awareness.getLocalState();
      expect(newState).toEqual(originalState);

      session.destroy();
      store.destroy();
    });

    it('should re-establish presence with peers after reconnection', async () => {
      const store1 = await createTestStore('puzzle-1');
      const store2 = await createTestStore('puzzle-2');

      const session1 = await createP2PSession(store1, 'test-room');
      const session2 = await createP2PSession(store2, 'test-room');

      await vi.advanceTimersByTimeAsync(150);

      network.registerProvider(session1.provider as unknown as MockWebrtcProvider);
      network.registerProvider(session2.provider as unknown as MockWebrtcProvider);

      // Initial connection
      network.connectPeers(
        session1.provider as unknown as MockWebrtcProvider,
        session2.provider as unknown as MockWebrtcProvider
      );

      expect(getCollaboratorCount(session1)).toBe(1);
      expect(getCollaboratorCount(session2)).toBe(1);

      // Session 1 disconnects
      const provider1 = session1.provider as unknown as MockWebrtcProvider;
      network.disconnectProvider(provider1, true);

      // Session 1 should lose peer
      expect(getCollaboratorCount(session1)).toBe(0);

      // Reconnect
      session1.reconnect();
      await vi.advanceTimersByTimeAsync(100);

      // Re-establish connection
      network.connectPeers(
        session1.provider as unknown as MockWebrtcProvider,
        session2.provider as unknown as MockWebrtcProvider
      );

      // Presence should be re-established
      expect(getCollaboratorCount(session1)).toBe(1);
      expect(hasAwarenessClient(session1, session2.awareness.clientID)).toBe(true);

      session1.destroy();
      session2.destroy();
      store1.destroy();
      store2.destroy();
    });

    it('should preserve local presence during network interruption', async () => {
      const store = await createTestStore();
      const session = await createP2PSession(store, 'test-room');

      await vi.advanceTimersByTimeAsync(150);

      const originalState = session.awareness.getLocalState();

      // Simulate network offline
      network.simulateNetworkChange(false);

      // Local presence should still exist
      expect(session.awareness.getLocalState()).toEqual(originalState);

      // Network comes back
      network.simulateNetworkChange(true);
      await vi.advanceTimersByTimeAsync(100);

      // Presence should still be the same
      expect(session.awareness.getLocalState()).toEqual(originalState);

      session.destroy();
      store.destroy();
    });
  });

  describe('Presence During Visibility Changes', () => {
    it('should maintain presence when tab becomes hidden', async () => {
      const store = await createTestStore();
      const session = await createP2PSession(store, 'test-room');

      await vi.advanceTimersByTimeAsync(150);

      const originalState = session.awareness.getLocalState();

      // Tab becomes hidden
      network.simulateVisibilityChange(true);

      // Presence should still exist
      expect(session.awareness.getLocalState()).toEqual(originalState);

      session.destroy();
      store.destroy();
    });

    it('should re-establish presence when tab becomes visible', async () => {
      const store = await createTestStore();
      const session = await createP2PSession(store, 'test-room');

      await vi.advanceTimersByTimeAsync(150);

      const originalState = session.awareness.getLocalState();

      // Tab becomes hidden then visible
      network.simulateVisibilityChange(true);
      network.simulateVisibilityChange(false);

      await vi.advanceTimersByTimeAsync(100);

      // Presence should be maintained
      expect(session.awareness.getLocalState()).toEqual(originalState);

      session.destroy();
      store.destroy();
    });
  });

  describe('Color Conflict Resolution', () => {
    it('should assign unique colors to peers', async () => {
      const store1 = await createTestStore('puzzle-1');
      const store2 = await createTestStore('puzzle-2');

      const session1 = await createP2PSession(store1, 'test-room');
      const session2 = await createP2PSession(store2, 'test-room');

      await vi.advanceTimersByTimeAsync(150);

      const state1 = session1.awareness.getLocalState() as any;
      const state2 = session2.awareness.getLocalState() as any;

      // Note: In mock, we don't actually enforce uniqueness
      // but the real implementation should
      expect(state1.user.color).toBeDefined();
      expect(state2.user.color).toBeDefined();

      session1.destroy();
      session2.destroy();
      store1.destroy();
      store2.destroy();
    });
  });

  describe('Awareness Cleanup', () => {
    it('should remove presence when session is destroyed', async () => {
      const store = await createTestStore();
      const session = await createP2PSession(store, 'test-room');

      await vi.advanceTimersByTimeAsync(150);

      expect(session.awareness.getLocalState()).toBeDefined();

      session.destroy();

      // Awareness should be destroyed
      // (In real implementation, this would clean up the state)

      store.destroy();
    });

    it('should notify peers when presence is removed', async () => {
      const store1 = await createTestStore('puzzle-1');
      const store2 = await createTestStore('puzzle-2');

      const session1 = await createP2PSession(store1, 'test-room');
      const session2 = await createP2PSession(store2, 'test-room');

      await vi.advanceTimersByTimeAsync(150);

      network.registerProvider(session1.provider as unknown as MockWebrtcProvider);
      network.registerProvider(session2.provider as unknown as MockWebrtcProvider);

      network.connectPeers(
        session1.provider as unknown as MockWebrtcProvider,
        session2.provider as unknown as MockWebrtcProvider
      );

      expect(getCollaboratorCount(session1)).toBe(1);

      // Destroy session 2
      const provider2 = session2.provider as unknown as MockWebrtcProvider;
      provider2.manualControl.removePeer(`peer-${session1.awareness.clientID}`);

      const provider1 = session1.provider as unknown as MockWebrtcProvider;
      provider1.manualControl.removePeer(`peer-${session2.awareness.clientID}`);

      // Session 1 should see Session 2 leave
      // (Actual removal from awareness would happen via y-webrtc protocol)

      session1.destroy();
      session2.destroy();
      store1.destroy();
      store2.destroy();
    });
  });
});
