/**
 * WebRTC provider module for P2P CRDT synchronization
 *
 * Provides peer-to-peer document sync via y-webrtc.
 * Configures ICE servers (STUN + TURN) for NAT traversal.
 */

import { WebrtcProvider } from 'y-webrtc';
import { PuzzleStore } from './puzzleStore';

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

  return {
    provider,
    destroy: () => {
      console.debug(`[webrtcProvider] Destroying P2P session for room: ${roomId}`);
      provider.destroy();
    },
  };
}
