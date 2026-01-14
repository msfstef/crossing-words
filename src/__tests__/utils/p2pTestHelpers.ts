/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * P2P Test Helpers
 *
 * Utilities for setting up and testing P2P scenarios
 */

import * as Y from 'yjs';
import type { PuzzleStore } from '../../crdt/puzzleStore';
import { createP2PSession } from '../../crdt/webrtcProvider';
import type { P2PSession } from '../../crdt/webrtcProvider';
import { getEntriesMap } from '../../crdt/puzzleDoc';
import { MockP2PNetwork } from './mockWebRTC';
import { WebrtcProvider } from '../__mocks__/y-webrtc';
import { vi } from 'vitest';

/**
 * Create a test puzzle store
 */
export async function createTestStore(puzzleId: string = 'test-puzzle'): Promise<PuzzleStore> {
  // Mock IndexedDB provider since we're in a test environment
  const doc = new Y.Doc();
  const entries = getEntriesMap(doc);

  // Create a mock store with all required PuzzleStore properties
  // Using type assertion to bypass private property check
  const mockStore = {
    doc,
    entries,
    puzzleId,
    ready: Promise.resolve(),
    destroy: vi.fn(),
    clearData: vi.fn().mockResolvedValue(undefined),
  } as unknown as PuzzleStore;

  return mockStore;
}

/**
 * Setup a P2P test scenario with multiple peers
 */
export async function setupP2PTest(options: {
  roomId: string;
  peerCount: number;
}): Promise<{
  sessions: P2PSession[];
  stores: PuzzleStore[];
  network: MockP2PNetwork;
  cleanup: () => void;
}> {
  const { roomId, peerCount } = options;
  const sessions: P2PSession[] = [];
  const stores: PuzzleStore[] = [];
  const network = new MockP2PNetwork();

  // Create multiple peers
  for (let i = 0; i < peerCount; i++) {
    const store = await createTestStore(`test-puzzle-${i}`);
    stores.push(store);

    const session = await createP2PSession(store, roomId);
    sessions.push(session);

    // Register provider in network
    network.registerProvider(session.provider as unknown as WebrtcProvider);
  }

  // Cleanup function
  const cleanup = () => {
    sessions.forEach(session => session.destroy());
    stores.forEach(store => store.destroy());
  };

  return { sessions, stores, network, cleanup };
}

/**
 * Wait for connection state to reach expected value
 */
export async function waitForConnectionState(
  session: P2PSession,
  expectedState: 'connected' | 'disconnected' | 'connecting',
  timeout = 5000
): Promise<void> {

  return new Promise((resolve, reject) => {
    // Check if already in desired state
    if (session.connectionState === expectedState) {
      resolve();
      return;
    }

    // Set up listener for state changes
    const unsubscribe = session.onConnectionChange(state => {
      if (state === expectedState) {
        unsubscribe();
        resolve();
      }
    });

    // Timeout
    setTimeout(() => {
      unsubscribe();
      if (session.connectionState !== expectedState) {
        reject(
          new Error(
            `Timeout waiting for connection state ${expectedState}. Current state: ${session.connectionState}`
          )
        );
      }
    }, timeout);
  });
}

/**
 * Wait for peer count to reach expected value
 */
export async function waitForPeerCount(
  session: P2PSession,
  expectedCount: number,
  timeout = 5000
): Promise<void> {

  return new Promise((resolve, reject) => {
    // Check if already at desired count
    if (session.peerCount === expectedCount) {
      resolve();
      return;
    }

    // Set up listener for peer count changes
    const unsubscribe = session.onPeerCountChange(count => {
      if (count === expectedCount) {
        unsubscribe();
        resolve();
      }
    });

    // Timeout
    setTimeout(() => {
      unsubscribe();
      if (session.peerCount !== expectedCount) {
        reject(
          new Error(
            `Timeout waiting for peer count ${expectedCount}. Current count: ${session.peerCount}`
          )
        );
      }
    }, timeout);
  });
}

/**
 * Wait for awareness to have expected number of collaborators
 */
export async function waitForAwarenessState(
  session: P2PSession,
  predicate: () => boolean,
  timeout = 5000
): Promise<void> {

  return new Promise((resolve, reject) => {
    // Check if already satisfied
    if (predicate()) {
      resolve();
      return;
    }

    // Set up listener
    const checkState = () => {
      if (predicate()) {
        session.awareness.off('change', checkState);
        resolve();
      }
    };

    session.awareness.on('change', checkState);

    // Timeout
    setTimeout(() => {
      session.awareness.off('change', checkState);
      if (!predicate()) {
        reject(new Error(`Timeout waiting for awareness state after ${timeout}ms`));
      }
    }, timeout);
  });
}

/**
 * Get collaborator count from awareness (excluding local client)
 */
export function getCollaboratorCount(session: P2PSession): number {
  const states = session.awareness.getStates();
  let count = 0;

  states.forEach((_, clientId) => {
    if (clientId !== session.awareness.clientID) {
      count++;
    }
  });

  return count;
}

/**
 * Check if awareness has a specific client
 */
export function hasAwarenessClient(session: P2PSession, clientId: number): boolean {
  return session.awareness.getStates().has(clientId);
}

/**
 * Get awareness state for a specific client
 */
export function getAwarenessState(session: P2PSession, clientId: number): any {
  return session.awareness.getStates().get(clientId);
}
