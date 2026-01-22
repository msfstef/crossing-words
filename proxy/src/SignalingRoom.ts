/**
 * SignalingRoom Durable Object for y-webrtc signaling.
 *
 * Implements per-room isolation with persistent state that survives peer
 * disconnections. Uses Cloudflare's WebSocket Hibernation API for cost
 * efficiency and provides server-side topic filtering.
 *
 * Features:
 * - One DO instance per puzzle room (isolated by room ID)
 * - Persistent peer registry in DO storage
 * - Server-side topic filtering (only broadcast to subscribers)
 * - Connection TTL (2 min without ping marks as stale)
 * - Visitor reconnect window (30 sec after disconnect)
 * - Room TTL (6 hours of inactivity triggers cleanup)
 *
 * Protocol (y-webrtc compatible):
 * - subscribe { topics: string[] } -> adds topics to connection
 * - unsubscribe { topics: string[] } -> removes topics from connection
 * - publish { topic: string, ... } -> broadcast to topic subscribers
 * - ping -> pong (keep-alive)
 */

import { DurableObject } from 'cloudflare:workers';
import {
  WsAttachment,
  RoomMeta,
  VisitorRecord,
  STORAGE_KEYS,
  TTL,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Env {}

/**
 * Generate a unique visitor ID.
 */
function generateVisitorId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export class SignalingRoom extends DurableObject<Env> {
  /**
   * Simulated time offset for testing TTL behavior.
   * In production this is always 0.
   */
  private timeOffset = 0;

  /**
   * In-memory map of WebSocket connections to their attachments.
   * This is rebuilt on DO wake from hibernation using tags.
   */
  private wsAttachments = new Map<WebSocket, WsAttachment>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Note: Attachment rebuild from hibernation happens lazily on first message
    // to avoid issues with test framework storage isolation
  }

  /**
   * Get current time (with test offset applied).
   */
  private now(): number {
    return Date.now() + this.timeOffset;
  }

  /**
   * Rebuild connection attachments from storage after hibernation wake.
   */
  private async rebuildAttachmentsFromStorage(): Promise<void> {
    const websockets = this.ctx.getWebSockets();
    if (websockets.length === 0) return;

    const visitors = await this.ctx.storage.list<VisitorRecord>({
      prefix: 'visitor:',
    });

    for (const ws of websockets) {
      // Get visitor ID from tags
      const tags = this.ctx.getTags(ws);
      const visitorId = tags[0];
      if (!visitorId) continue;

      const visitorKey = STORAGE_KEYS.visitorKey(visitorId);
      const record = visitors.get(visitorKey);

      if (record) {
        const attachment: WsAttachment = {
          visitorId: record.visitorId,
          subscribedTopics: record.subscribedTopics,
          connectedAt: record.connectedAt,
          lastSeen: record.lastSeen,
        };
        this.wsAttachments.set(ws, attachment);
      }
    }
  }

  /**
   * Get attachment for a WebSocket.
   */
  private getAttachment(ws: WebSocket): WsAttachment | undefined {
    return this.wsAttachments.get(ws);
  }

  /**
   * Set attachment for a WebSocket.
   */
  private setAttachment(ws: WebSocket, attachment: WsAttachment): void {
    this.wsAttachments.set(ws, attachment);
  }

  /**
   * Handle incoming HTTP requests.
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Test endpoints (only for testing)
    if (url.pathname.startsWith('/__test__/')) {
      return this.handleTestEndpoint(url, request);
    }

    // WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Create attachment for this connection
    const visitorId = generateVisitorId();
    const attachment: WsAttachment = {
      visitorId,
      subscribedTopics: [],
      connectedAt: this.now(),
      lastSeen: this.now(),
    };

    // Accept WebSocket with hibernation API (use visitorId as tag for lookup)
    this.ctx.acceptWebSocket(server, [visitorId]);
    this.setAttachment(server, attachment);

    // Initialize or update room metadata
    await this.ensureRoomMeta();

    // Schedule cleanup alarm if not already scheduled
    await this.scheduleAlarmIfNeeded();

    console.log(`[SignalingRoom] New connection: ${visitorId}`);

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle incoming WebSocket messages.
   */
  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    // Ignore binary messages
    if (typeof message !== 'string') {
      return;
    }

    // Get attachment
    const attachment = this.getAttachment(ws);
    if (!attachment) {
      // Try to rebuild from storage if missing (after hibernation)
      await this.rebuildAttachmentsFromStorage();
      const rebuiltAttachment = this.getAttachment(ws);
      if (!rebuiltAttachment) {
        console.error('[SignalingRoom] No attachment found for WebSocket');
        return;
      }
      return this.handleMessage(ws, rebuiltAttachment, message);
    }

    return this.handleMessage(ws, attachment, message);
  }

  /**
   * Process a message with attachment.
   */
  private async handleMessage(
    ws: WebSocket,
    attachment: WsAttachment,
    message: string
  ): Promise<void> {
    // Update lastSeen
    attachment.lastSeen = this.now();
    this.setAttachment(ws, attachment);

    // Parse message
    let msg: { type?: string; topics?: string[]; topic?: string; [key: string]: unknown };
    try {
      msg = JSON.parse(message);
    } catch {
      console.error('[SignalingRoom] Failed to parse message');
      return;
    }

    if (!msg.type) {
      return;
    }

    switch (msg.type) {
      case 'ping':
        await this.handlePing(ws, attachment);
        break;

      case 'subscribe':
        if (Array.isArray(msg.topics)) {
          await this.handleSubscribe(ws, attachment, msg.topics);
        }
        break;

      case 'unsubscribe':
        if (Array.isArray(msg.topics)) {
          await this.handleUnsubscribe(ws, attachment, msg.topics);
        }
        break;

      case 'publish':
        if (typeof msg.topic === 'string') {
          await this.handlePublish(ws, attachment, msg);
        }
        break;
    }
  }

  /**
   * Handle WebSocket close.
   */
  async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string
  ): Promise<void> {
    const attachment = this.getAttachment(ws);
    if (!attachment) {
      // Try to get visitor ID from tags
      const tags = this.ctx.getTags(ws);
      const visitorId = tags[0];
      if (visitorId) {
        console.log(`[SignalingRoom] Connection closed (from tag): ${visitorId}`);
        // Mark visitor as disconnected in storage
        const visitorKey = STORAGE_KEYS.visitorKey(visitorId);
        const record = await this.ctx.storage.get<VisitorRecord>(visitorKey);
        if (record) {
          record.isConnected = false;
          record.lastSeen = this.now();
          await this.ctx.storage.put(visitorKey, record);
        }
      }
      return;
    }

    console.log(`[SignalingRoom] Connection closed: ${attachment.visitorId}`);

    // Mark visitor as disconnected (but don't delete yet - allow reconnect window)
    const visitorKey = STORAGE_KEYS.visitorKey(attachment.visitorId);
    const record = await this.ctx.storage.get<VisitorRecord>(visitorKey);
    if (record) {
      record.isConnected = false;
      record.lastSeen = this.now();
      await this.ctx.storage.put(visitorKey, record);
    }

    // Remove from in-memory map
    this.wsAttachments.delete(ws);
  }

  /**
   * Handle WebSocket errors.
   */
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    const attachment = this.getAttachment(ws);
    console.error(
      `[SignalingRoom] WebSocket error for ${attachment?.visitorId ?? 'unknown'}:`,
      error
    );
  }

  /**
   * Alarm handler for periodic cleanup.
   */
  async alarm(): Promise<void> {
    console.log('[SignalingRoom] Alarm triggered');

    const now = this.now();
    const roomMeta = await this.ctx.storage.get<RoomMeta>(STORAGE_KEYS.ROOM_META);

    // Check room TTL
    if (roomMeta && now - roomMeta.lastActivityAt > TTL.ROOM_INACTIVITY) {
      const connections = this.ctx.getWebSockets();
      if (connections.length === 0) {
        // No active connections and room is stale - delete everything
        console.log('[SignalingRoom] Room expired, deleting all storage');
        await this.ctx.storage.deleteAll();
        this.wsAttachments.clear();
        return;
      }
    }

    // Clean up stale connections
    await this.cleanupStaleConnections(now);

    // Clean up disconnected visitor records past reconnect window
    await this.cleanupDisconnectedVisitors(now);

    // Reschedule alarm if room is still active
    const connections = this.ctx.getWebSockets();
    const hasStorage = (await this.ctx.storage.get(STORAGE_KEYS.ROOM_META)) !== undefined;
    if (connections.length > 0 || hasStorage) {
      await this.scheduleAlarmIfNeeded();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Message Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Handle ping - respond with pong and update lastSeen.
   */
  private async handlePing(ws: WebSocket, attachment: WsAttachment): Promise<void> {
    ws.send(JSON.stringify({ type: 'pong' }));

    // Update visitor record if exists
    const visitorKey = STORAGE_KEYS.visitorKey(attachment.visitorId);
    const record = await this.ctx.storage.get<VisitorRecord>(visitorKey);
    if (record) {
      record.lastSeen = this.now();
      await this.ctx.storage.put(visitorKey, record);
    }
  }

  /**
   * Handle subscribe - add topics to connection and persist.
   */
  private async handleSubscribe(
    ws: WebSocket,
    attachment: WsAttachment,
    topics: string[]
  ): Promise<void> {
    // Add topics to attachment (avoid duplicates)
    const newTopics = topics.filter((t) => !attachment.subscribedTopics.includes(t));
    attachment.subscribedTopics.push(...newTopics);
    this.setAttachment(ws, attachment);

    // Persist visitor record
    const visitorKey = STORAGE_KEYS.visitorKey(attachment.visitorId);
    const record: VisitorRecord = {
      visitorId: attachment.visitorId,
      subscribedTopics: attachment.subscribedTopics,
      connectedAt: attachment.connectedAt,
      lastSeen: this.now(),
      isConnected: true,
    };
    await this.ctx.storage.put(visitorKey, record);

    // Update room activity
    await this.updateRoomActivity();
  }

  /**
   * Handle unsubscribe - remove topics from connection and persist.
   */
  private async handleUnsubscribe(
    ws: WebSocket,
    attachment: WsAttachment,
    topics: string[]
  ): Promise<void> {
    // Remove topics from attachment
    attachment.subscribedTopics = attachment.subscribedTopics.filter(
      (t) => !topics.includes(t)
    );
    this.setAttachment(ws, attachment);

    // Update visitor record
    const visitorKey = STORAGE_KEYS.visitorKey(attachment.visitorId);
    const record = await this.ctx.storage.get<VisitorRecord>(visitorKey);
    if (record) {
      record.subscribedTopics = attachment.subscribedTopics;
      record.lastSeen = this.now();
      await this.ctx.storage.put(visitorKey, record);
    }
  }

  /**
   * Handle publish - broadcast to topic subscribers only.
   */
  private async handlePublish(
    _ws: WebSocket,
    _attachment: WsAttachment,
    msg: { topic?: string; [key: string]: unknown }
  ): Promise<void> {
    const topic = msg.topic;
    if (!topic) {
      return;
    }

    // Update room activity
    await this.updateRoomActivity();

    // Find all connections subscribed to this topic
    const allConnections = this.ctx.getWebSockets();
    const subscribers: WebSocket[] = [];

    for (const conn of allConnections) {
      const connAttachment = this.getAttachment(conn);
      if (connAttachment && connAttachment.subscribedTopics.includes(topic)) {
        subscribers.push(conn);
      }
    }

    if (subscribers.length === 0) {
      return;
    }

    // Prepare response with client count
    const response = JSON.stringify({
      ...msg,
      clients: subscribers.length,
    });

    // Broadcast to all subscribers (including sender - y-webrtc expects this)
    let successCount = 0;
    for (const conn of subscribers) {
      try {
        conn.send(response);
        successCount++;
      } catch (e) {
        console.error('[SignalingRoom] Failed to send to connection:', e);
      }
    }

    console.log(
      `[SignalingRoom] Published to topic "${topic}": ${successCount}/${subscribers.length} subscribers`
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Storage Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Ensure room metadata exists in storage.
   */
  private async ensureRoomMeta(): Promise<void> {
    const existing = await this.ctx.storage.get<RoomMeta>(STORAGE_KEYS.ROOM_META);
    if (!existing) {
      const meta: RoomMeta = {
        createdAt: this.now(),
        lastActivityAt: this.now(),
      };
      await this.ctx.storage.put(STORAGE_KEYS.ROOM_META, meta);
    } else {
      // Update lastActivityAt on new connection
      existing.lastActivityAt = this.now();
      await this.ctx.storage.put(STORAGE_KEYS.ROOM_META, existing);
    }
  }

  /**
   * Update room activity timestamp.
   */
  private async updateRoomActivity(): Promise<void> {
    const meta = await this.ctx.storage.get<RoomMeta>(STORAGE_KEYS.ROOM_META);
    if (meta) {
      meta.lastActivityAt = this.now();
      await this.ctx.storage.put(STORAGE_KEYS.ROOM_META, meta);
    }
  }

  /**
   * Schedule cleanup alarm if not already scheduled.
   */
  private async scheduleAlarmIfNeeded(): Promise<void> {
    const currentAlarm = await this.ctx.storage.getAlarm();
    if (!currentAlarm) {
      // Schedule for real time (not simulated time)
      await this.ctx.storage.setAlarm(Date.now() + TTL.ALARM_INTERVAL);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Close connections that haven't pinged within the TTL.
   */
  private async cleanupStaleConnections(now: number): Promise<void> {
    const connections = this.ctx.getWebSockets();

    for (const ws of connections) {
      const attachment = this.getAttachment(ws);
      if (!attachment) {
        continue;
      }

      if (now - attachment.lastSeen > TTL.CONNECTION_STALE) {
        console.log(`[SignalingRoom] Closing stale connection: ${attachment.visitorId}`);
        try {
          ws.close(1000, 'Connection timed out');
        } catch (e) {
          console.error('[SignalingRoom] Error closing connection:', e);
        }
        this.wsAttachments.delete(ws);
      }
    }
  }

  /**
   * Delete visitor records that are disconnected past the reconnect window.
   */
  private async cleanupDisconnectedVisitors(now: number): Promise<void> {
    const storage = await this.ctx.storage.list<VisitorRecord>({
      prefix: 'visitor:',
    });

    for (const [key, record] of storage) {
      if (!record.isConnected && now - record.lastSeen > TTL.VISITOR_RECONNECT_WINDOW) {
        console.log(`[SignalingRoom] Deleting disconnected visitor: ${record.visitorId}`);
        await this.ctx.storage.delete(key);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Test Endpoints
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Handle test-only endpoints for verifying internal state.
   */
  private async handleTestEndpoint(
    url: URL,
    request: Request
  ): Promise<Response> {
    const endpoint = url.pathname.replace('/__test__/', '');

    switch (endpoint) {
      case 'storage': {
        // Return all storage contents for test verification
        const all = await this.ctx.storage.list();
        const storage: Record<string, unknown> = {};
        for (const [key, value] of all) {
          storage[key] = value;
        }
        return new Response(JSON.stringify({ storage }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'trigger-alarm': {
        // Manually trigger the alarm handler
        await this.alarm();
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'advance-time': {
        // Advance simulated time for TTL testing
        const body = await request.json() as { deltaMs?: number };
        if (typeof body.deltaMs === 'number') {
          this.timeOffset += body.deltaMs;
        }
        return new Response(JSON.stringify({ ok: true, timeOffset: this.timeOffset }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'reset': {
        // Reset room state for test isolation
        this.timeOffset = 0;
        await this.ctx.storage.deleteAll();
        this.wsAttachments.clear();
        // Close all connections
        for (const ws of this.ctx.getWebSockets()) {
          try {
            ws.close(1000, 'Test reset');
          } catch {
            // Ignore
          }
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response('Not found', { status: 404 });
    }
  }
}
