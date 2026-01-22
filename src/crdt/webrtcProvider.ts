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
 * IMPORTANT: Keep under 5 servers to avoid slow ICE candidate discovery.
 * WebRTC warns: "Using five or more STUN/TURN servers slows down discovery"
 *
 * STUN: ~75% of connections work with just STUN
 * TURN: Required for ~20-30% of users behind restrictive NATs/firewalls
 *
 * Server choices:
 * - Google STUN: Most reliable, global anycast infrastructure
 * - Open Relay TURN: Free tier (20GB/month), 99.999% uptime, ports 80/443
 *   bypass corporate firewalls, TURNS+SSL handles deep packet inspection
 */
const ICE_SERVERS: RTCIceServer[] = [
  // STUN: Google is highly reliable with global anycast (one server is enough)
  { urls: 'stun:stun.l.google.com:19302' },
  // TURN: Open Relay on ports that bypass firewalls
  // - Port 443 (HTTPS port) works through most corporate firewalls
  // - TURNS (TLS) handles deep packet inspection firewalls
  {
    urls: [
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
 *
 * @param roomId - Room ID to include in the signaling URL for per-room DO routing
 */
function getSignalingServers(roomId: string): string[] {
  const customServer = import.meta.env.VITE_SIGNALING_SERVER;
  const encodedRoomId = encodeURIComponent(roomId);

  if (customServer) {
    // Support custom servers with or without query params
    const separator = customServer.includes('?') ? '&' : '?';
    return [`${customServer}${separator}room=${encodedRoomId}`];
  }

  // Default: Cloudflare Worker signaling with room parameter
  return [`wss://crossing-words-proxy.msfstef.workers.dev/signaling?room=${encodedRoomId}`];
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
    signaling: getSignalingServers(roomId),
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

  // Connection health monitoring via awareness heartbeat
  // y-webrtc broadcasts awareness updates regularly - if we stop receiving
  // updates from remote peers, the connection is likely dead
  let lastRemoteAwarenessUpdate = Date.now();
  const AWARENESS_STALE_THRESHOLD = 60000; // 60 seconds without remote updates = stale

  const trackRemoteAwarenessUpdate = (changes: {
    added: number[];
    updated: number[];
    removed: number[];
  }) => {
    // Check if any changes are from remote clients (not our own clientID)
    const hasRemoteChanges =
      changes.added.some((id) => id !== awareness.clientID) ||
      changes.updated.some((id) => id !== awareness.clientID);

    if (hasRemoteChanges) {
      lastRemoteAwarenessUpdate = Date.now();
    }
  };

  awareness.on('change', trackRemoteAwarenessUpdate);
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
        reconnectWithStatePreservation();
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
  // Also track sudden peer loss for connection health monitoring
  let lastHadPeersAt = 0;
  let hadPeersRecently = false;

  provider.on('peers', (event: { webrtcPeers?: string[]; removed?: string[] }) => {
    const count = event.webrtcPeers?.length ?? 0;
    const previousCount = peerCount;
    updatePeerCount(count);

    // Track when we have/had peers for health monitoring
    if (count > 0) {
      lastHadPeersAt = Date.now();
      hadPeersRecently = true;
    }

    // Detect sudden peer loss: we had peers, now we don't, but signaling is still "connected"
    // This indicates WebRTC peer connections failed (ICE failure, network change, etc.)
    if (previousCount > 0 && count === 0 && provider.connected && hadPeersRecently) {
      const timeSinceHadPeers = Date.now() - lastHadPeersAt;

      // If we just lost all peers (within last 5 seconds of having them), schedule recovery check
      if (timeSinceHadPeers < 5000) {
        console.debug('[P2P] Sudden peer loss detected, scheduling recovery check...');

        // Wait to see if peers reconnect (they might just be experiencing brief network issues)
        // This implements the "wait and see" approach recommended for ICE disconnected state
        setTimeout(() => {
          if (isDestroyed) return;

          // If we still have no peers after waiting, and signaling is connected,
          // the WebRTC connections likely failed - trigger reconnect
          if (peerCount === 0 && provider.connected && hadPeersRecently) {
            console.debug('[P2P] Peers did not reconnect after 10s, triggering reconnect...');
            hadPeersRecently = false; // Reset to avoid repeated reconnects
            resetReconnectAttempts();
            reconnectWithStatePreservation();
          }
        }, 10000); // Wait 10 seconds (recommended for ICE recovery)
      }
    }
  });

  /**
   * Helper to preserve and restore awareness state across disconnect/connect.
   *
   * IMPORTANT: y-webrtc's disconnect() broadcasts "I'm leaving" to all peers
   * and destroys all WebRTC peer connections. This is disruptive!
   * Only call this when connection is actually broken, not preemptively.
   *
   * We add a small delay between disconnect and connect to:
   * 1. Let peers process the departure before we reconnect
   * 2. Allow network state to stabilize
   * 3. Prevent rapid reconnect loops
   */
  let isReconnecting = false;
  const reconnectWithStatePreservation = () => {
    // Prevent overlapping reconnect attempts
    if (isReconnecting) {
      console.debug('[P2P] Reconnect already in progress, skipping');
      return;
    }

    // Save local awareness state before disconnect
    const savedLocalState = awareness.getLocalState();

    isReconnecting = true;
    console.debug('[P2P] Disconnecting for reconnect...');
    provider.disconnect();

    // Small delay before reconnecting to let signaling process the disconnect
    // and to prevent race conditions with peers
    setTimeout(() => {
      if (isDestroyed) {
        isReconnecting = false;
        return;
      }

      console.debug('[P2P] Reconnecting...');
      provider.connect();

      // Restore local awareness state after reconnect
      // Wait a tick to ensure provider is connected before setting state
      setTimeout(() => {
        isReconnecting = false;
        if (isDestroyed) return;

        if (savedLocalState && typeof savedLocalState === 'object') {
          Object.entries(savedLocalState).forEach(([key, value]) => {
            awareness.setLocalStateField(key, value);
          });
          console.debug('[P2P] Awareness state restored after reconnect');
        }
      }, 100);
    }, 200);
  };

  // Network online/offline handlers
  // NOTE: Don't blindly reconnect on 'online' - check if we actually need to
  // The WebRTC connection might have survived the brief network interruption
  const handleOnline = () => {
    if (isDestroyed) return;

    console.debug('[P2P] Network online detected, checking connection health...');

    // Wait a moment for network to stabilize, then check if we need to reconnect
    setTimeout(() => {
      if (isDestroyed) return;

      // Only reconnect if we're actually disconnected
      // The connection might have survived the brief network interruption
      if (!provider.connected || connectionState === 'disconnected') {
        console.debug('[P2P] Connection lost during offline period, reconnecting...');
        resetReconnectAttempts();
        reconnectWithStatePreservation();
      } else {
        console.debug('[P2P] Connection survived network change, no reconnect needed');
      }
    }, 1000);
  };

  const handleOffline = () => {
    console.debug('[P2P] Network offline detected');
    // Don't immediately mark as disconnected - wait to see if connection dies
    // The WebRTC connection might survive brief offline periods
  };

  // Visibility change handler for mobile sleep/wake cycles
  // IMPORTANT: Don't eagerly disconnect/reconnect on visibility change!
  // y-webrtc's disconnect() broadcasts "I'm leaving" to peers and destroys
  // all peer connections. This breaks working connections.
  // WebRTC connections with active data channels are exempt from Chrome's
  // heavy throttling, so connections often survive tab switches just fine.
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && !isDestroyed) {
      console.debug('[P2P] Page became visible, checking connection health...');

      // Don't force reconnect immediately - connections often survive tab switches
      // Instead, schedule a health check to see if we actually need to reconnect
      setTimeout(() => {
        if (isDestroyed) return;

        // Check if signaling WebSocket is still alive by looking at provider state
        // and whether we've lost all peers unexpectedly
        const signalingConnected = provider.connected;

        if (!signalingConnected) {
          console.debug('[P2P] Signaling disconnected while hidden, reconnecting...');
          resetReconnectAttempts();
          reconnectWithStatePreservation();
        } else if (connectionState === 'disconnected') {
          console.debug('[P2P] Connection state is disconnected, reconnecting...');
          resetReconnectAttempts();
          reconnectWithStatePreservation();
        } else {
          console.debug('[P2P] Connection appears healthy after visibility change');
        }
      }, 1000); // Wait 1 second to let connection stabilize after tab becomes visible
    }
  };

  // Focus event handler - fires when window gains focus (complements visibilitychange)
  // This catches cases like switching back to the browser from another app
  // NOTE: We're more conservative here - don't force reconnects unless connection is truly dead
  let lastFocusTime = Date.now();
  const handleFocus = () => {
    if (isDestroyed) return;

    const now = Date.now();
    const timeSinceLastFocus = now - lastFocusTime;
    lastFocusTime = now;

    // Only check connection after a significant time away (30+ seconds)
    // Short focus changes don't warrant reconnection checks
    if (timeSinceLastFocus > 30000) {
      console.debug('[P2P] Window focused after', Math.round(timeSinceLastFocus / 1000), 'seconds, checking connection...');

      // Delay the check to let connection stabilize
      setTimeout(() => {
        if (isDestroyed) return;

        // Only reconnect if connection is actually disconnected (not just "no peers")
        // Having no peers is normal if others left while we were away
        if (connectionState === 'disconnected' || !provider.connected) {
          console.debug('[P2P] Connection lost during focus away, reconnecting');
          resetReconnectAttempts();
          reconnectWithStatePreservation();
        } else {
          console.debug('[P2P] Connection healthy after focus');
        }
      }, 1000);
    }
  };

  // Page show handler - fires when page is shown (including from bfcache)
  // This is more reliable than visibilitychange for detecting page restoration
  const handlePageShow = (event: PageTransitionEvent) => {
    if (isDestroyed) return;

    // persisted indicates the page was restored from back-forward cache
    // bfcache can freeze WebSocket connections, but not always - check first
    if (event.persisted) {
      console.debug('[P2P] Page restored from bfcache, checking connection health...');

      // Wait a moment for the page to fully restore, then check connection
      setTimeout(() => {
        if (isDestroyed) return;

        // Only reconnect if connection is actually broken
        if (!provider.connected || connectionState === 'disconnected') {
          console.debug('[P2P] Connection broken after bfcache restore, reconnecting...');
          resetReconnectAttempts();
          reconnectWithStatePreservation();
        } else {
          console.debug('[P2P] Connection survived bfcache restore');
        }
      }, 500);
    }
  };

  // Set up network and visibility event listeners
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleFocus);
  window.addEventListener('pageshow', handlePageShow);

  // Periodic health check: verify connection health using multiple signals
  // Best practices from WebRTC community:
  // 1. Monitor signaling WebSocket state
  // 2. Use awareness updates as heartbeat (if we have peers but no updates, connection is stale)
  // 3. Don't reconnect just because there are no peers - that's normal!
  const healthCheckInterval = setInterval(() => {
    if (isDestroyed) return;

    const now = Date.now();
    const timeSinceRemoteUpdate = now - lastRemoteAwarenessUpdate;

    // Check 1: Signaling WebSocket disconnected
    if (!provider.connected && connectionState !== 'disconnected') {
      console.debug('[P2P] Health check: signaling disconnected, updating state');
      updateState('disconnected');
      // Auto-reconnect will be triggered by the state change handler
      return;
    }

    // Check 2: Awareness heartbeat - if we have peers but no awareness updates
    // for a long time, the WebRTC data channels may be dead even though
    // signaling appears connected
    if (
      peerCount > 0 &&
      connectionState === 'connected' &&
      timeSinceRemoteUpdate > AWARENESS_STALE_THRESHOLD
    ) {
      console.debug(
        `[P2P] Health check: no awareness updates from peers in ${Math.round(timeSinceRemoteUpdate / 1000)}s, connection may be stale`
      );
      // Give it one more interval before reconnecting - awareness updates
      // might just be infrequent if users aren't actively editing
      if (timeSinceRemoteUpdate > AWARENESS_STALE_THRESHOLD * 2) {
        console.debug('[P2P] Health check: connection stale, triggering reconnect');
        resetReconnectAttempts();
        reconnectWithStatePreservation();
        return;
      }
    }

    // Log periodic status for debugging
    if (connectionState === 'connected') {
      const updateAge = peerCount > 0 ? `${Math.round(timeSinceRemoteUpdate / 1000)}s ago` : 'n/a';
      console.debug(
        `[P2P] Health check: OK (signaling: connected, peers: ${peerCount}, last remote update: ${updateAge})`
      );
    }
  }, 30000); // Check every 30 seconds for more responsive detection

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
      reconnectWithStatePreservation();
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
      awareness.off('change', trackRemoteAwarenessUpdate);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handlePageShow);

      // Clear subscribers
      connectionSubscribers.clear();
      peerCountSubscribers.clear();

      // Destroy provider
      provider.destroy();
    },
  };

  return session;
}
