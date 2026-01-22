/**
 * Shared types for the signaling server.
 */

/**
 * Data attached to each WebSocket connection via hibernation API.
 */
export interface WsAttachment {
  /** Unique ID for this visitor (generated on connect) */
  visitorId: string;
  /** Topics this connection is subscribed to */
  subscribedTopics: string[];
  /** Timestamp of connection */
  connectedAt: number;
  /** Last ping/message timestamp */
  lastSeen: number;
}

/**
 * Room metadata stored in Durable Object storage.
 * Key: "room:meta"
 */
export interface RoomMeta {
  createdAt: number;
  lastActivityAt: number;
}

/**
 * Visitor record stored in Durable Object storage.
 * Key: "visitor:{visitorId}"
 */
export interface VisitorRecord {
  visitorId: string;
  subscribedTopics: string[];
  connectedAt: number;
  lastSeen: number;
  /** false if disconnected but within reconnect window */
  isConnected: boolean;
}

/**
 * y-webrtc protocol message types (Client -> Server)
 */
export type ClientMessage =
  | { type: 'subscribe'; topics: string[] }
  | { type: 'unsubscribe'; topics: string[] }
  | { type: 'publish'; topic: string; [key: string]: unknown }
  | { type: 'ping' };

/**
 * y-webrtc protocol message types (Server -> Client)
 */
export type ServerMessage =
  | { type: 'pong' }
  | { type: 'publish'; topic: string; clients: number; [key: string]: unknown };

/**
 * Storage keys
 */
export const STORAGE_KEYS = {
  ROOM_META: 'room:meta',
  visitorKey: (visitorId: string) => `visitor:${visitorId}`,
} as const;

/**
 * TTL constants (in milliseconds)
 *
 * Values chosen based on research of multiplayer game frameworks (Colyseus, Socket.IO)
 * and collaborative app best practices:
 * - Colyseus recommends 20s reconnection window for games
 * - Socket.IO defaults to 45s ping timeout (25s interval + 20s timeout)
 * - Mobile apps need longer timeouts due to tab switching/backgrounding
 * - Must stay under proxy idle timeouts (typically 60s for AWS ELB)
 *
 * For a collaborative puzzle app where users may:
 * - Switch tabs to look up answers
 * - Get briefly distracted
 * - Have flaky mobile connections
 * We use more generous timeouts than fast-paced games.
 */
export const TTL = {
  /** Room expires after 6 hours of inactivity (reasonable for a puzzle session) */
  ROOM_INACTIVITY: 6 * 60 * 60 * 1000,

  /**
   * Connection marked stale after 90 seconds without ping.
   * Balances quick detection with tolerance for brief tab switches.
   * Must be < proxy timeouts (60s) but we use hibernation API so this is OK.
   */
  CONNECTION_STALE: 90 * 1000,

  /**
   * Disconnected visitor cleanup after 3 minutes.
   * Generous window for:
   * - Mobile app switches (iOS/Android can pause WebSockets)
   * - Brief network interruptions
   * - Users looking something up in another tab
   * Colyseus uses 20s for games; we're more forgiving for casual collaboration.
   */
  VISITOR_RECONNECT_WINDOW: 3 * 60 * 1000,

  /** Alarm interval - runs every 60 seconds while room is active */
  ALARM_INTERVAL: 60 * 1000,
} as const;
