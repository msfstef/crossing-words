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
 */
export const TTL = {
  /** Room expires after 6 hours of inactivity */
  ROOM_INACTIVITY: 6 * 60 * 60 * 1000,
  /** Connection marked stale after 2 minutes without ping */
  CONNECTION_STALE: 2 * 60 * 1000,
  /** Disconnected visitor cleanup after 30 seconds */
  VISITOR_RECONNECT_WINDOW: 30 * 1000,
  /** Alarm interval - runs every 60 seconds while room is active */
  ALARM_INTERVAL: 60 * 1000,
} as const;
