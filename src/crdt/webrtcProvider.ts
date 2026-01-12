/**
 * WebRTC provider module for P2P CRDT synchronization
 *
 * Provides peer-to-peer document sync via y-webrtc.
 * Configures ICE servers (STUN + TURN) for NAT traversal.
 */

import { WebrtcProvider } from 'y-webrtc';
import type { Awareness } from 'y-protocols/awareness';
import { PuzzleStore } from './puzzleStore';
import { assignUniqueColor, generateNickname } from '../collaboration/colors';

/**
 * Connection state for P2P sessions.
 * - 'disconnected': Not connected to any peers (solo mode or lost connection)
 * - 'connecting': Attempting to connect to signaling server and peers
 * - 'connected': Successfully connected to at least one peer
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

/**
 * ICE server configuration for WebRTC connections.
 * Includes STUN servers for NAT discovery and TURN for relay fallback.
 *
 * STUN: ~75% of connections work with just STUN
 * TURN: Required for ~20-30% of users behind restrictive NATs/firewalls
 */
const ICE_SERVERS: RTCIceServer[] = [
  // STUN servers (free, unlimited)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  // TURN server (Open Relay free tier - 20GB/month)
  {
    urls: [
      'turn:staticauth.openrelay.metered.ca:80',
      'turn:staticauth.openrelay.metered.ca:443',
      'turns:staticauth.openrelay.metered.ca:443',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

/**
 * Get signaling servers based on environment.
 * Development uses local signaling server (y-webrtc bin/server.js).
 * Production should use custom signaling server for reliability.
 */
function getSignalingServers(): string[] {
  // In development, use local signaling server for reliable testing
  if (import.meta.env.DEV) {
    return ['ws://localhost:4444'];
  }

  // Production: use public servers (should be replaced with custom server)
  return [
    'wss://signaling.yjs.dev',
    'wss://y-webrtc-signaling-eu.herokuapp.com',
    'wss://y-webrtc-signaling-us.herokuapp.com',
  ];
}

/**
 * P2P session interface for managing WebRTC connections.
 */
export interface P2PSession {
  /** The underlying y-webrtc provider instance */
  provider: WebrtcProvider;
  /** Yjs Awareness for presence tracking */
  awareness: Awareness;
  /** Current connection state */
  connectionState: ConnectionState;
  /** Subscribe to connection state changes. Returns unsubscribe function. */
  onConnectionChange: (callback: (state: ConnectionState) => void) => () => void;
  /** Cleanup function to destroy the session */
  destroy: () => void;
}

/**
 * Creates a P2P session for collaborative puzzle solving.
 *
 * IMPORTANT: Waits for store.ready before creating the provider.
 * This ensures local IndexedDB state is loaded first, preventing
 * the case where an empty state syncs and overwrites progress.
 *
 * @param store - The PuzzleStore with Y.Doc to sync
 * @param roomId - Unique room identifier for peer discovery
 * @returns Promise resolving to P2PSession with provider and destroy method
 *
 * @example
 * ```typescript
 * const store = createPuzzleStore('nyt-2024-01-15');
 * const session = await createP2PSession(store, 'my-room-123');
 *
 * // Later, clean up
 * session.destroy();
 * ```
 */
export async function createP2PSession(
  store: PuzzleStore,
  roomId: string
): Promise<P2PSession> {
  // Wait for IndexedDB to sync first - critical to prevent empty state sync
  await store.ready;

  console.debug(`[webrtcProvider] Creating P2P session for room: ${roomId}`);

  const provider = new WebrtcProvider(roomId, store.doc, {
    signaling: getSignalingServers(),
    peerOpts: {
      config: { iceServers: ICE_SERVERS },
    },
  });

  // Get awareness from provider and set initial local state
  const awareness = provider.awareness;

  // Get colors already in use by other clients
  const usedColors: string[] = [];
  awareness.getStates().forEach((state, clientId) => {
    if (clientId !== awareness.clientID) {
      const userState = state as { user?: { color?: string } } | undefined;
      if (userState?.user?.color) {
        usedColors.push(userState.user.color);
      }
    }
  });

  awareness.setLocalStateField('user', {
    name: generateNickname(),
    color: assignUniqueColor(usedColors, awareness.clientID),
  });
  awareness.setLocalStateField('cursor', null);

  // Re-check color uniqueness when awareness changes (in case we connected before others)
  let hasCheckedColorConflict = false;
  const checkColorConflict = () => {
    if (hasCheckedColorConflict) return;

    const myState = awareness.getLocalState() as { user?: { color?: string } } | null;
    const myColor = myState?.user?.color?.toLowerCase();
    if (!myColor) return;

    // Check if any other client has the same color
    let hasConflict = false;
    const otherColors: string[] = [];

    awareness.getStates().forEach((state, clientId) => {
      if (clientId !== awareness.clientID) {
        const userState = state as { user?: { color?: string } } | undefined;
        if (userState?.user?.color) {
          otherColors.push(userState.user.color);
          if (userState.user.color.toLowerCase() === myColor) {
            hasConflict = true;
          }
        }
      }
    });

    if (hasConflict) {
      // Re-assign unique color
      const newColor = assignUniqueColor(otherColors, awareness.clientID);
      if (newColor.toLowerCase() !== myColor) {
        console.debug('[webrtcProvider] Color conflict detected, reassigning to:', newColor);
        awareness.setLocalStateField('user', {
          ...myState?.user,
          color: newColor,
        });
      }
    }

    hasCheckedColorConflict = true;
  };

  // Check for conflicts when awareness changes
  awareness.on('change', checkColorConflict);

  // Track connection state internally
  let connectionState: ConnectionState = 'connecting';
  const subscribers = new Set<(state: ConnectionState) => void>();

  // Helper to update state and notify subscribers
  const updateState = (newState: ConnectionState) => {
    if (connectionState !== newState) {
      connectionState = newState;
      console.debug(`[P2P] state: ${newState}`);
      subscribers.forEach((callback) => callback(newState));
    }
  };

  // Listen to provider status events
  // y-webrtc emits 'status' events with { connected: boolean }
  provider.on('status', (event: { connected: boolean }) => {
    updateState(event.connected ? 'connected' : 'disconnected');
  });

  // Create session object with getter for current state
  const session: P2PSession = {
    provider,
    awareness,
    get connectionState() {
      return connectionState;
    },
    onConnectionChange: (callback: (state: ConnectionState) => void) => {
      subscribers.add(callback);
      // Immediately call with current state
      callback(connectionState);
      return () => {
        subscribers.delete(callback);
      };
    },
    destroy: () => {
      console.debug(`[webrtcProvider] Destroying P2P session for room: ${roomId}`);
      awareness.off('change', checkColorConflict);
      subscribers.clear();
      provider.destroy();
    },
  };

  return session;
}
