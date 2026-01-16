/**
 * WebRTC provider module for P2P CRDT synchronization
 *
 * Provides peer-to-peer document sync via y-webrtc.
 * Configures ICE servers (STUN + TURN) for NAT traversal.
 */

import { WebrtcProvider } from 'y-webrtc';
import type { Awareness } from 'y-protocols/awareness';
import { PuzzleStore } from './puzzleStore';
import { assignUniqueColor } from '../collaboration/colors';
import { getProfile } from '../lib/profileStorage';

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
 * Get signaling servers from environment variable or default to production.
 * Set VITE_SIGNALING_SERVER to override (e.g., ws://localhost:4444 for local testing).
 * Defaults to production Cloudflare Worker signaling server.
 */
function getSignalingServers(): string[] {
  const customServer = import.meta.env.VITE_SIGNALING_SERVER;
  if (customServer) {
    return [customServer];
  }

  // Default: Cloudflare Worker signaling (works in both dev and prod)
  return ['wss://crossing-words-proxy.msfstef.workers.dev/signaling'];
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
  /** Force reconnection to peers (useful after sleep/wake cycles) */
  reconnect: () => void;
  /** Cleanup function to destroy the session */
  destroy: () => void;
  /** Number of connected peers */
  peerCount: number;
  /** Subscribe to peer count changes. Returns unsubscribe function. */
  onPeerCountChange: (callback: (count: number) => void) => () => void;
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

  // Assign a unique color for this user (what others will see)
  // Set awareness state BEFORE connecting to ensure it's ready when peers connect
  const profile = await getProfile();
  const userName = profile.nickname;
  // Use thumbnail for P2P transmission (smaller, more efficient)
  const userAvatar = profile.avatarThumbnail;
  const userColor = assignUniqueColor(usedColors, awareness.clientID);

  awareness.setLocalStateField('user', {
    name: userName,
    color: userColor,
    avatar: userAvatar ?? undefined,
  });
  awareness.setLocalStateField('cursor', null);

  console.debug(`[webrtcProvider] Awareness initialized: ${userName} (${userColor}), avatar: ${userAvatar ? 'yes' : 'no'}, clientID: ${awareness.clientID}`);

  // Re-check color uniqueness when awareness changes (in case we connected before others)
  // Debounce to avoid excessive re-checks during rapid updates
  let colorCheckTimeout: ReturnType<typeof setTimeout> | null = null;
  const checkColorConflict = () => {
    // Debounce: wait 100ms after last change before checking
    if (colorCheckTimeout) clearTimeout(colorCheckTimeout);
    colorCheckTimeout = setTimeout(() => {
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
        // Re-assign unique color (preserve name and avatar)
        const newColor = assignUniqueColor(otherColors, awareness.clientID);
        if (newColor.toLowerCase() !== myColor) {
          console.debug('[webrtcProvider] Color conflict detected, reassigning to:', newColor);
          const currentUser = myState?.user as { name?: string; avatar?: string } | undefined;
          awareness.setLocalStateField('user', {
            name: currentUser?.name ?? userName,
            color: newColor,
            avatar: currentUser?.avatar,
          });
        }
      }
    }, 100);
  };

  // Check for conflicts when awareness changes
  awareness.on('change', checkColorConflict);

  // Track connection state internally
  let connectionState: ConnectionState = 'connecting';
  let peerCount = 0;
  const connectionSubscribers = new Set<(state: ConnectionState) => void>();
  const peerCountSubscribers = new Set<(count: number) => void>();

  // Reconnection state
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_DELAY = 30000; // 30 seconds max
  const BASE_RECONNECT_DELAY = 1000; // Start with 1 second
  let isDestroyed = false;

  // Helper to update state and notify subscribers
  const updateState = (newState: ConnectionState) => {
    if (connectionState !== newState) {
      connectionState = newState;
      console.debug(`[P2P] state: ${newState}`);
      connectionSubscribers.forEach((callback) => callback(newState));
    }
  };

  // Helper to update peer count and notify subscribers
  const updatePeerCount = (newCount: number) => {
    if (peerCount !== newCount) {
      peerCount = newCount;
      console.debug(`[P2P] peer count: ${newCount}`);
      peerCountSubscribers.forEach((callback) => callback(newCount));
    }
  };

  // Exponential backoff reconnection logic
  const scheduleReconnect = () => {
    if (isDestroyed) return;
    if (reconnectTimeout) return; // Already scheduled

    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
      MAX_RECONNECT_DELAY
    );
    reconnectAttempts++;

    console.debug(`[P2P] Scheduling reconnect attempt ${reconnectAttempts} in ${delay}ms`);

    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null;
      if (!isDestroyed && connectionState === 'disconnected') {
        console.debug('[P2P] Executing scheduled reconnect');
        provider.disconnect();
        provider.connect();
      }
    }, delay);
  };

  // Reset reconnection attempts on successful connection
  const resetReconnectAttempts = () => {
    reconnectAttempts = 0;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  };

  // Listen to provider status events
  // y-webrtc emits 'status' events with { connected: boolean }
  provider.on('status', (event: { connected: boolean }) => {
    const newState = event.connected ? 'connected' : 'disconnected';
    updateState(newState);

    if (newState === 'connected') {
      resetReconnectAttempts();
    } else if (newState === 'disconnected' && !isDestroyed) {
      // Schedule automatic reconnection with exponential backoff
      scheduleReconnect();
    }
  });

  // Listen to peer connection/disconnection events
  // y-webrtc emits 'peers' events with { added: string[], removed: string[], webrtcPeers: string[] }
  provider.on('peers', (event: { webrtcPeers?: string[] }) => {
    const count = event.webrtcPeers?.length ?? 0;
    updatePeerCount(count);
  });

  // Network online/offline handlers
  const handleOnline = () => {
    console.debug('[P2P] Network online, triggering reconnect');
    resetReconnectAttempts(); // Reset backoff on network recovery
    provider.disconnect();
    provider.connect();
  };

  const handleOffline = () => {
    console.debug('[P2P] Network offline detected');
    updateState('disconnected');
  };

  // Visibility change handler for mobile sleep/wake cycles
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && !isDestroyed) {
      console.debug('[P2P] Page became visible, triggering reconnect');
      resetReconnectAttempts(); // Reset backoff on wake
      provider.disconnect();
      provider.connect();
    }
  };

  // Set up network and visibility event listeners
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Periodic health check: verify signaling connection is alive
  // The signaling server expects ping/pong, but y-webrtc handles this internally
  // We just need to monitor if the connection is stale
  let lastPeerCount = 0;
  let staleConnectionCheckCount = 0;
  const healthCheckInterval = setInterval(() => {
    if (isDestroyed) return;

    // If we're "connected" but peer count hasn't changed in a while
    // and we have 0 peers, the connection might be stale
    if (connectionState === 'connected' && peerCount === 0 && lastPeerCount === 0) {
      staleConnectionCheckCount++;

      // After 3 consecutive checks with no peers (3 minutes), force reconnect
      if (staleConnectionCheckCount >= 3) {
        console.debug('[P2P] Stale connection detected (connected but no peers), forcing reconnect');
        staleConnectionCheckCount = 0;
        resetReconnectAttempts();
        provider.disconnect();
        provider.connect();
      }
    } else {
      staleConnectionCheckCount = 0;
    }

    lastPeerCount = peerCount;
  }, 60000); // Check every minute

  // Create session object with getter for current state
  const session: P2PSession = {
    provider,
    awareness,
    get connectionState() {
      return connectionState;
    },
    get peerCount() {
      return peerCount;
    },
    onConnectionChange: (callback: (state: ConnectionState) => void) => {
      connectionSubscribers.add(callback);
      // Immediately call with current state
      callback(connectionState);
      return () => {
        connectionSubscribers.delete(callback);
      };
    },
    onPeerCountChange: (callback: (count: number) => void) => {
      peerCountSubscribers.add(callback);
      // Immediately call with current count
      callback(peerCount);
      return () => {
        peerCountSubscribers.delete(callback);
      };
    },
    reconnect: () => {
      console.debug(`[webrtcProvider] Manual reconnection for room: ${roomId}`);
      resetReconnectAttempts(); // Reset backoff on manual reconnect
      provider.disconnect();
      provider.connect();
    },
    destroy: () => {
      console.debug(`[webrtcProvider] Destroying P2P session for room: ${roomId}`);
      isDestroyed = true;

      // Clear reconnection timeout
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }

      // Clear health check interval
      clearInterval(healthCheckInterval);

      // Clear color check timeout
      if (colorCheckTimeout) clearTimeout(colorCheckTimeout);

      // Remove event listeners
      awareness.off('change', checkColorConflict);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      // Clear subscribers
      connectionSubscribers.clear();
      peerCountSubscribers.clear();

      // Destroy provider
      provider.destroy();
    },
  };

  return session;
}
