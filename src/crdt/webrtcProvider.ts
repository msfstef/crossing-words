/**
 * WebRTC provider module for P2P CRDT synchronization
 *
 * Provides peer-to-peer document sync via y-webrtc with WebSocket fallback.
 * - Primary: WebRTC (peer-to-peer, free bandwidth)
 * - Fallback: WebSocket (server-relayed, works when WebRTC blocked by VPN)
 *
 * Configures ICE servers (STUN + TURN) for NAT traversal.
 */

import { WebrtcProvider } from 'y-webrtc';
import { WebsocketProvider } from 'y-websocket';
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
 * Transport type for P2P sessions.
 * - 'webrtc': Direct peer-to-peer connection (preferred)
 * - 'websocket': Server-relayed connection (fallback when WebRTC blocked)
 */
export type TransportType = 'webrtc' | 'websocket';

/**
 * Timeout before falling back to WebSocket (in milliseconds).
 * If WebRTC doesn't connect within this time, we switch to WebSocket.
 */
const WEBRTC_FALLBACK_TIMEOUT = 10000; // 10 seconds

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
 * Get WebSocket server URL for y-websocket fallback.
 * Set VITE_WEBSOCKET_URL to override (e.g., ws://localhost:8787/ywebsocket for local testing).
 * Defaults to production Cloudflare Worker WebSocket sync server.
 */
function getWebsocketServerUrl(roomId: string): string {
  const customServer = import.meta.env.VITE_WEBSOCKET_URL;
  if (customServer) {
    // Custom server: append room ID to the base URL
    return `${customServer}/${encodeURIComponent(roomId)}`;
  }

  // Default: Cloudflare Worker WebSocket sync
  return `wss://crossing-words-proxy.msfstef.workers.dev/ywebsocket/${encodeURIComponent(roomId)}`;
}

/**
 * P2P session interface for managing WebRTC/WebSocket connections.
 */
export interface P2PSession {
  /** The underlying provider instance (WebRTC or WebSocket) */
  provider: WebrtcProvider | WebsocketProvider;
  /** Yjs Awareness for presence tracking */
  awareness: Awareness;
  /** Current connection state */
  connectionState: ConnectionState;
  /** Current transport type (webrtc or websocket) */
  transportType: TransportType;
  /** Subscribe to connection state changes. Returns unsubscribe function. */
  onConnectionChange: (callback: (state: ConnectionState) => void) => () => void;
  /** Subscribe to transport type changes. Returns unsubscribe function. */
  onTransportChange: (callback: (type: TransportType) => void) => () => void;
  /** Cleanup function to destroy the session */
  destroy: () => void;
}

/**
 * Set up awareness with unique color assignment and conflict detection.
 */
function setupAwareness(awareness: Awareness): () => void {
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
  awareness.setLocalStateField('user', {
    name: generateNickname(),
    color: assignUniqueColor(usedColors, awareness.clientID),
  });
  awareness.setLocalStateField('cursor', null);

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
        // Re-assign unique color
        const newColor = assignUniqueColor(otherColors, awareness.clientID);
        if (newColor.toLowerCase() !== myColor) {
          console.debug('[P2P] Color conflict detected, reassigning to:', newColor);
          awareness.setLocalStateField('user', {
            ...myState?.user,
            color: newColor,
          });
        }
      }
    }, 100);
  };

  // Check for conflicts when awareness changes
  awareness.on('change', checkColorConflict);

  // Return cleanup function
  return () => {
    if (colorCheckTimeout) clearTimeout(colorCheckTimeout);
    awareness.off('change', checkColorConflict);
  };
}

/**
 * Creates a P2P session for collaborative puzzle solving.
 *
 * Uses WebRTC as primary transport with automatic WebSocket fallback
 * if WebRTC fails to connect within the timeout (e.g., VPN blocking).
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

  console.debug(`[P2P] Creating session for room: ${roomId}`);

  // Track state
  let connectionState: ConnectionState = 'connecting';
  let transportType: TransportType = 'webrtc';
  let currentProvider: WebrtcProvider | WebsocketProvider;
  let currentAwareness: Awareness;
  let cleanupAwareness: (() => void) | null = null;
  let fallbackTimeout: ReturnType<typeof setTimeout> | null = null;
  let isDestroyed = false;

  // Subscribers for state changes
  const connectionSubscribers = new Set<(state: ConnectionState) => void>();
  const transportSubscribers = new Set<(type: TransportType) => void>();

  // Helper to update connection state and notify subscribers
  const updateConnectionState = (newState: ConnectionState) => {
    if (connectionState !== newState && !isDestroyed) {
      connectionState = newState;
      console.debug(`[P2P] Connection state: ${newState} (${transportType})`);
      connectionSubscribers.forEach((callback) => callback(newState));
    }
  };

  // Helper to update transport type and notify subscribers
  const updateTransportType = (newType: TransportType) => {
    if (transportType !== newType && !isDestroyed) {
      transportType = newType;
      console.debug(`[P2P] Transport changed to: ${newType}`);
      transportSubscribers.forEach((callback) => callback(newType));
    }
  };

  // Create WebSocket provider as fallback
  const createWebsocketFallback = () => {
    if (isDestroyed) return;

    console.debug('[P2P] WebRTC timeout, falling back to WebSocket');

    // Clean up WebRTC provider
    if (cleanupAwareness) cleanupAwareness();
    currentProvider.destroy();

    // Create WebSocket provider
    const wsUrl = getWebsocketServerUrl(roomId);
    const wsProvider = new WebsocketProvider(wsUrl, roomId, store.doc);
    currentProvider = wsProvider;
    currentAwareness = wsProvider.awareness;
    updateTransportType('websocket');

    // Set up awareness for new provider
    cleanupAwareness = setupAwareness(currentAwareness);

    // Listen to WebSocket provider status
    wsProvider.on('status', (event: { status: string }) => {
      if (event.status === 'connected') {
        updateConnectionState('connected');
      } else if (event.status === 'disconnected') {
        updateConnectionState('disconnected');
      }
    });

    // Update session references
    session.provider = wsProvider;
    session.awareness = currentAwareness;
  };

  // Start with WebRTC provider
  const webrtcProvider = new WebrtcProvider(roomId, store.doc, {
    signaling: getSignalingServers(),
    peerOpts: {
      config: { iceServers: ICE_SERVERS },
    },
  });
  currentProvider = webrtcProvider;
  currentAwareness = webrtcProvider.awareness;

  // Set up awareness
  cleanupAwareness = setupAwareness(currentAwareness);

  // Track if we have actual peer connections (not just signaling)
  // The y-webrtc 'status' event fires for signaling connection, not peer connections
  // We need to check awareness for actual peers to detect if WebRTC is working
  let hasPeers = false;
  let signalingConnected = false;

  // Check for actual peers via awareness
  // If other clients appear in awareness, WebRTC is actually working
  const checkForPeers = () => {
    const peerCount = currentAwareness.getStates().size - 1; // Exclude self
    if (peerCount > 0 && !hasPeers) {
      hasPeers = true;
      console.debug(`[P2P] Found ${peerCount} peer(s) via awareness`);
      // Cancel fallback timeout since we have actual peers
      if (fallbackTimeout) {
        clearTimeout(fallbackTimeout);
        fallbackTimeout = null;
      }
      updateConnectionState('connected');
    }
  };

  // Listen for awareness changes to detect peers
  currentAwareness.on('change', checkForPeers);
  // Also check immediately in case peers are already present
  checkForPeers();

  // Listen to WebRTC provider status (signaling connection)
  webrtcProvider.on('status', (event: { connected: boolean }) => {
    if (event.connected) {
      signalingConnected = true;
      console.debug('[P2P] Signaling connected, waiting for peers...');
      // Don't update connection state yet - wait for actual peers
      // Only update to 'connected' if we already have peers
      if (hasPeers) {
        updateConnectionState('connected');
      }
    } else {
      signalingConnected = false;
      // Only update to disconnected if we had peers before
      if (hasPeers) {
        updateConnectionState('disconnected');
      }
    }
  });

  // Set up fallback timeout
  // Trigger fallback if no actual peers discovered after timeout
  // (regardless of signaling connection status)
  fallbackTimeout = setTimeout(() => {
    if (!hasPeers && !isDestroyed) {
      console.debug('[P2P] No peers discovered after timeout, signaling connected:', signalingConnected);
      // Clean up awareness listener before fallback
      currentAwareness.off('change', checkForPeers);
      createWebsocketFallback();
    }
  }, WEBRTC_FALLBACK_TIMEOUT);

  // Create session object
  const session: P2PSession = {
    provider: currentProvider,
    awareness: currentAwareness,
    get connectionState() {
      return connectionState;
    },
    get transportType() {
      return transportType;
    },
    onConnectionChange: (callback: (state: ConnectionState) => void) => {
      connectionSubscribers.add(callback);
      // Immediately call with current state
      callback(connectionState);
      return () => {
        connectionSubscribers.delete(callback);
      };
    },
    onTransportChange: (callback: (type: TransportType) => void) => {
      transportSubscribers.add(callback);
      // Immediately call with current type
      callback(transportType);
      return () => {
        transportSubscribers.delete(callback);
      };
    },
    destroy: () => {
      console.debug(`[P2P] Destroying session for room: ${roomId}`);
      isDestroyed = true;
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
      // Clean up peer check listener
      currentAwareness.off('change', checkForPeers);
      if (cleanupAwareness) cleanupAwareness();
      connectionSubscribers.clear();
      transportSubscribers.clear();
      currentProvider.destroy();
    },
  };

  return session;
}
