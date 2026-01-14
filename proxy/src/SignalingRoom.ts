/**
 * SignalingRoom Durable Object for y-webrtc signaling.
 *
 * Implements the y-webrtc signaling protocol using Cloudflare's WebSocket
 * Hibernation API for cost efficiency. Only billed during message processing,
 * not for connection duration.
 *
 * Protocol:
 * - ping -> pong (keep-alive)
 * - publish with topic -> broadcast to all connections (y-webrtc handles topic filtering)
 */

import { DurableObject } from 'cloudflare:workers';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Env {}

export class SignalingRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
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

    // Use Hibernation API - connection survives DO eviction
    // Only billed during message processing, not connection duration
    this.ctx.acceptWebSocket(server);

    console.log('[SignalingRoom] New WebSocket connection accepted');

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle incoming WebSocket messages.
   * Implements y-webrtc signaling protocol.
   */
  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    if (typeof message !== 'string') {
      return;
    }

    try {
      const msg = JSON.parse(message) as {
        type: string;
        topic?: string;
        [key: string]: unknown;
      };

      switch (msg.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        case 'publish':
          if (msg.topic) {
            this.handlePublish(msg);
          }
          break;

        // subscribe/unsubscribe not needed - y-webrtc handles topic filtering client-side
        // We broadcast all publish messages to all connections
      }
    } catch (e) {
      console.error('[SignalingRoom] Failed to parse message:', e);
    }
  }

  /**
   * Handle WebSocket close.
   * Cloudflare automatically cleans up the connection.
   */
  async webSocketClose(
    _ws: WebSocket,
    code: number,
    reason: string
  ): Promise<void> {
    console.log(`[SignalingRoom] WebSocket closed: code=${code}, reason=${reason}`);
    // Cleanup handled automatically by Cloudflare
  }

  /**
   * Handle WebSocket errors.
   */
  async webSocketError(_ws: WebSocket, error: unknown): Promise<void> {
    console.error('[SignalingRoom] WebSocket error:', error);
  }

  /**
   * Broadcast publish message to all connected WebSockets.
   * y-webrtc protocol requires `clients` count in response.
   */
  private handlePublish(msg: { type: string; topic?: string; [key: string]: unknown }): void {
    const allWs = this.ctx.getWebSockets();
    const response = JSON.stringify({
      ...msg,
      clients: allWs.length,
    });

    let successCount = 0;
    let failCount = 0;

    for (const conn of allWs) {
      try {
        conn.send(response);
        successCount++;
      } catch (e) {
        failCount++;
        console.error('[SignalingRoom] Failed to send to connection:', e);
        // Connection closed, CF will call webSocketClose
      }
    }

    console.log(`[SignalingRoom] Broadcast to ${successCount}/${allWs.length} connections (${failCount} failed)`);
  }
}
