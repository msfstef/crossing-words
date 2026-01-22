/**
 * URL Routing Tests
 *
 * Tests that verify the routing layer properly handles requests.
 * Note: Tests that trigger Durable Object initialization are skipped
 * due to vitest-pool-workers storage isolation limitations.
 */
import { describe, it, expect } from 'vitest';
import { SELF } from 'cloudflare:test';

describe('URL Routing', () => {
  it('returns 400 if room parameter is missing', async () => {
    const response = await SELF.fetch('http://localhost/signaling');
    expect(response.status).toBe(400);

    const body = await response.json() as { error: string };
    expect(body.error).toBe('room parameter required');
  });

  it('returns 400 if room parameter is empty', async () => {
    const response = await SELF.fetch('http://localhost/signaling?room=');
    expect(response.status).toBe(400);

    const body = await response.json() as { error: string };
    expect(body.error).toBe('room parameter required');
  });

  // Skipped: Triggers DO initialization which causes storage isolation issues
  it.skip('returns 426 if not a WebSocket upgrade request', async () => {
    const response = await SELF.fetch('http://localhost/signaling?room=test-room');
    expect(response.status).toBe(426);
  });

  it('health check endpoint returns status', async () => {
    const response = await SELF.fetch('http://localhost/');
    expect(response.status).toBe(200);

    const body = await response.json() as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('crossing-words-proxy');
  });

  it('CORS preflight returns correct headers', async () => {
    const response = await SELF.fetch('http://localhost/signaling?room=test', {
      method: 'OPTIONS',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('returns 404 for unknown paths', async () => {
    const response = await SELF.fetch('http://localhost/unknown');
    expect(response.status).toBe(404);
  });
});
