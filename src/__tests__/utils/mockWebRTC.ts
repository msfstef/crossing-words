/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-function-type */
/**
 * Mock WebRTC Provider utilities for P2P testing
 *
 * This module provides utilities to simulate P2P scenarios including:
 * - Connection/disconnection
 * - Peer discovery
 * - Awareness state changes
 * - Reconnection logic
 */

import { WebrtcProvider } from '../__mocks__/y-webrtc';

/**
 * Create a simulated P2P network for testing
 * Returns functions to control the network
 */
export class MockP2PNetwork {
  private providers: Map<string, WebrtcProvider> = new Map();

  /**
   * Register a provider in the network
   */
  registerProvider(provider: WebrtcProvider): void {
    this.providers.set(provider.roomId, provider);
  }

  /**
   * Simulate two peers connecting to each other
   */
  connectPeers(provider1: WebrtcProvider, provider2: WebrtcProvider): void {
    if (provider1.roomId !== provider2.roomId) {
      throw new Error('Providers must be in the same room to connect');
    }

    const peer1Id = `peer-${provider1.awareness.clientID}`;
    const peer2Id = `peer-${provider2.awareness.clientID}`;

    provider1.manualControl.addPeer(peer2Id);
    provider2.manualControl.addPeer(peer1Id);

    // Sync awareness states
    const state1 = provider1.awareness.getLocalState();
    const state2 = provider2.awareness.getLocalState();

    if (state1) {
      provider2.awareness.getStates().set(provider1.awareness.clientID, state1);
      // Manually trigger the change event listeners
      const listeners = (provider2.awareness as any)._observers?.get?.('change') || [];
      listeners.forEach((fn: Function) => {
        fn({
          added: [provider1.awareness.clientID],
          updated: [],
          removed: [],
        }, 'local');
      });
    }

    if (state2) {
      provider1.awareness.getStates().set(provider2.awareness.clientID, state2);
      // Manually trigger the change event listeners
      const listeners = (provider1.awareness as any)._observers?.get?.('change') || [];
      listeners.forEach((fn: Function) => {
        fn({
          added: [provider2.awareness.clientID],
          updated: [],
          removed: [],
        }, 'local');
      });
    }
  }

  /**
   * Simulate network disconnection for a provider
   * Optionally clear awareness states from other providers
   */
  disconnectProvider(provider: WebrtcProvider, clearAwareness = false): void {
    provider.manualControl.disconnect();

    if (clearAwareness) {
      // Remove this provider's awareness from all other providers in the room
      this.providers.forEach(otherProvider => {
        if (otherProvider !== provider && otherProvider.roomId === provider.roomId) {
          const states = otherProvider.awareness.getStates();
          if (states.has(provider.awareness.clientID)) {
            states.delete(provider.awareness.clientID);
            // Trigger change event
            const listeners = (otherProvider.awareness as any)._observers?.get?.('change') || [];
            listeners.forEach((fn: Function) => {
              fn({
                added: [],
                updated: [],
                removed: [provider.awareness.clientID],
              }, 'local');
            });
          }
        }
      });

      // Clear remote states from this provider
      provider.awareness.getStates().forEach((_, clientId) => {
        if (clientId !== provider.awareness.clientID) {
          provider.awareness.getStates().delete(clientId);
        }
      });
    }
  }

  /**
   * Simulate network reconnection for a provider
   */
  reconnectProvider(provider: WebrtcProvider): void {
    provider.manualControl.connect();
  }

  /**
   * Simulate visibility change (tab hidden/shown)
   */
  simulateVisibilityChange(hidden: boolean): void {
    // Dispatch visibilitychange event
    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      configurable: true,
      value: hidden ? 'hidden' : 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  /**
   * Simulate online/offline network events
   */
  simulateNetworkChange(online: boolean): void {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
  }
}

/**
 * Wait for a condition to be true
 * Useful for async testing
 */
export async function waitFor(
  condition: () => boolean,
  timeout = 5000,
  interval = 50
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

/**
 * Wait for a specific amount of time
 */
export async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
