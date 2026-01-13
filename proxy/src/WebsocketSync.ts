/**
 * WebsocketSync Durable Object for y-websocket protocol.
 *
 * Implements the y-websocket sync protocol using Cloudflare's WebSocket
 * Hibernation API for cost efficiency. This serves as a fallback when
 * WebRTC P2P connections fail (e.g., when VPN blocks WebRTC).
 *
 * Key differences from SignalingRoom:
 * - Binary protocol (not JSON)
 * - Server maintains Y.Doc state in memory
 * - Per-room Durable Object instances (not global)
 * - Memory-only (no SQLite) - auto-cleaned on eviction
 *
 * Protocol (y-websocket):
 * - messageSync (0): Y.js sync protocol messages
 * - messageAwareness (1): Presence/cursor data
 */

import { DurableObject } from 'cloudflare:workers';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Env {}

// Message types matching y-websocket protocol
const messageSync = 0;
const messageAwareness = 1;

export class WebsocketSync extends DurableObject<Env> {
  // In-memory Y.Doc - cleared when DO is evicted (no persistence)
  private doc: Y.Doc;
  // Awareness state for all connected clients
  private awareness: awarenessProtocol.Awareness;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);

    // Clean up awareness when clients disconnect
    this.awareness.on('update', ({ added, updated, removed }: {
      added: number[];
      updated: number[];
      removed: number[];
    }) => {
      const changedClients = added.concat(updated, removed);
      this.broadcastAwareness(changedClients);
    });
  }

  /**
   * Handle incoming HTTP requests - upgrade to WebSocket.
   */
  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Use Hibernation API - only billed during message processing
    // Tag with a unique client ID for awareness tracking
    const clientId = crypto.randomUUID();
    this.ctx.acceptWebSocket(server, [clientId]);

    // Send initial sync state to new client
    this.sendSyncStep1(server);

    // Send current awareness state to new client
    const awarenessStates = this.awareness.getStates();
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(
          this.awareness,
          Array.from(awarenessStates.keys())
        )
      );
      try {
        server.send(encoding.toUint8Array(encoder));
      } catch {
        // Client disconnected
      }
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Send sync step 1 to initiate sync with client.
   */
  private sendSyncStep1(ws: WebSocket): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    try {
      ws.send(encoding.toUint8Array(encoder));
    } catch {
      // Client disconnected
    }
  }

  /**
   * Handle incoming WebSocket messages.
   * Implements y-websocket binary protocol.
   */
  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    if (typeof message === 'string') {
      // y-websocket uses binary, ignore string messages
      return;
    }

    try {
      const data = new Uint8Array(message);
      const decoder = decoding.createDecoder(data);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case messageSync:
          this.handleSyncMessage(ws, decoder);
          break;

        case messageAwareness:
          this.handleAwarenessMessage(ws, decoder);
          break;
      }
    } catch (e) {
      console.error('[WebsocketSync] Failed to process message:', e);
    }
  }

  /**
   * Handle Y.js sync protocol messages.
   */
  private handleSyncMessage(ws: WebSocket, decoder: decoding.Decoder): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);

    const syncMessageType = syncProtocol.readSyncMessage(
      decoder,
      encoder,
      this.doc,
      this
    );

    // If there's a response to send (sync step 2 or update)
    if (encoding.length(encoder) > 1) {
      try {
        ws.send(encoding.toUint8Array(encoder));
      } catch {
        // Client disconnected
      }
    }

    // If we received an update, broadcast to other clients
    if (syncMessageType === syncProtocol.messageYjsUpdate) {
      this.broadcastUpdate(ws);
    }
  }

  /**
   * Handle awareness protocol messages.
   */
  private handleAwarenessMessage(
    _ws: WebSocket,
    decoder: decoding.Decoder
  ): void {
    const update = decoding.readVarUint8Array(decoder);
    awarenessProtocol.applyAwarenessUpdate(
      this.awareness,
      update,
      this
    );
  }

  /**
   * Broadcast Y.Doc update to all connected clients except sender.
   */
  private broadcastUpdate(sender: WebSocket): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, this.doc);
    const message = encoding.toUint8Array(encoder);

    const allWs = this.ctx.getWebSockets();
    for (const ws of allWs) {
      if (ws !== sender) {
        try {
          ws.send(message);
        } catch {
          // Client disconnected
        }
      }
    }
  }

  /**
   * Broadcast awareness update to all connected clients.
   */
  private broadcastAwareness(changedClients: number[]): void {
    if (changedClients.length === 0) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
    );
    const message = encoding.toUint8Array(encoder);

    const allWs = this.ctx.getWebSockets();
    for (const ws of allWs) {
      try {
        ws.send(message);
      } catch {
        // Client disconnected
      }
    }
  }

  /**
   * Handle WebSocket close - clean up awareness for this client.
   */
  async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string
  ): Promise<void> {
    // Get client ID from WebSocket tags
    const tags = this.ctx.getTags(ws);
    if (tags.length > 0) {
      const clientId = tags[0];
      // Remove awareness state for disconnected client
      // Note: awareness uses numeric IDs, but we track connections by UUID tags
      // The client-side awareness ID will be cleaned up automatically
    }

    // If no more connections, the DO will hibernate and eventually be evicted
    // Memory (including doc and awareness) will be freed
  }

  /**
   * Handle WebSocket error.
   */
  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('[WebsocketSync] WebSocket error:', error);
  }
}
