/**
 * Stable client ID for duration tracking.
 *
 * Unlike Yjs awareness.clientID which changes per session,
 * this ID is persisted in localStorage to survive page reloads.
 */

const CLIENT_ID_KEY = 'crossing-words-client-id';

/**
 * Gets or creates a stable client ID for this device.
 * Uses crypto.randomUUID() for generation, persisted in localStorage.
 *
 * @returns A stable UUID string for this client
 */
export function getStableClientId(): string {
  let clientId = localStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  return clientId;
}
