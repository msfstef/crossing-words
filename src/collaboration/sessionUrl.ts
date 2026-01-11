/**
 * Session URL utilities for collaborative puzzle sharing
 *
 * Provides:
 * - Timeline ID generation for unique collaborative sessions
 * - Shareable URL construction and parsing
 * - Web Share API with clipboard fallback
 */

import { nanoid } from 'nanoid';

/**
 * Generate a unique timeline ID for a collaborative session.
 * Uses nanoid (21 chars, URL-safe, collision-resistant).
 *
 * @returns A unique timeline ID string
 *
 * @example
 * ```typescript
 * const timelineId = generateTimelineId();
 * // => "V1StGXR8_Z5jdHi6B-myT"
 * ```
 */
export function generateTimelineId(): string {
  return nanoid();
}

/**
 * Build a shareable URL for a collaborative puzzle session.
 *
 * URL format: `{origin}{pathname}#puzzle={puzzleId}&timeline={timelineId}`
 *
 * @param puzzleId - The puzzle identifier (will be URI-encoded)
 * @param timelineId - The timeline/session identifier
 * @returns Full shareable URL string
 *
 * @example
 * ```typescript
 * const url = buildShareUrl('nyt-2026-01-11', 'abc123xyz');
 * // => "https://example.com/#puzzle=nyt-2026-01-11&timeline=abc123xyz"
 * ```
 */
export function buildShareUrl(puzzleId: string, timelineId: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#puzzle=${encodeURIComponent(puzzleId)}&timeline=${timelineId}`;
}

/**
 * Parsed share URL result containing puzzle and timeline identifiers.
 */
export interface ParsedShareUrl {
  puzzleId: string;
  timelineId: string;
}

/**
 * Parse the current URL hash for puzzle and timeline parameters.
 *
 * Supports the new format: #puzzle={puzzleId}&timeline={timelineId}
 *
 * @returns Parsed puzzle and timeline IDs, or null if not a valid share URL
 *
 * @example
 * ```typescript
 * // With URL: https://example.com/#puzzle=nyt-2026-01-11&timeline=abc123
 * const result = parseShareUrl();
 * // => { puzzleId: 'nyt-2026-01-11', timelineId: 'abc123' }
 *
 * // With URL: https://example.com/ (no hash)
 * const result = parseShareUrl();
 * // => null
 * ```
 */
export function parseShareUrl(): ParsedShareUrl | null {
  const hash = window.location.hash;
  if (!hash || hash === '#') {
    return null;
  }

  // Parse hash parameters
  const params = new URLSearchParams(hash.slice(1));
  const puzzleId = params.get('puzzle');
  const timelineId = params.get('timeline');

  if (puzzleId && timelineId) {
    return {
      puzzleId: decodeURIComponent(puzzleId),
      timelineId,
    };
  }

  return null;
}

/**
 * Parse legacy room URL format (#room=X).
 * Used for backwards compatibility with old share links.
 *
 * @returns The room/timeline ID if present, undefined otherwise
 *
 * @example
 * ```typescript
 * // With URL: https://example.com/#room=abc123
 * const roomId = parseLegacyRoomUrl();
 * // => 'abc123'
 * ```
 */
export function parseLegacyRoomUrl(): string | undefined {
  const hash = window.location.hash;
  const match = hash.match(/room=([^&]+)/);
  return match ? match[1] : undefined;
}

/**
 * Result type for shareSession function.
 */
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Share a session URL using the Web Share API with clipboard fallback.
 *
 * On mobile devices with Web Share API support, opens the native share sheet.
 * On desktop or unsupported browsers, copies the URL to clipboard.
 *
 * @param url - The URL to share
 * @param title - Title for the share (used in native share sheet)
 * @returns Promise resolving to the share result:
 *   - 'shared': Successfully shared via native share sheet
 *   - 'copied': Copied to clipboard (fallback)
 *   - 'cancelled': User cancelled the share dialog
 *   - 'failed': Both sharing and clipboard copy failed
 *
 * @example
 * ```typescript
 * const result = await shareSession(
 *   'https://example.com/#puzzle=nyt&timeline=abc',
 *   'Join my crossword puzzle'
 * );
 *
 * if (result === 'copied') {
 *   showToast('Link copied to clipboard!');
 * }
 * ```
 */
export async function shareSession(url: string, title: string): Promise<ShareResult> {
  const shareData = { title, url };

  // Try native Web Share API first
  if (navigator.canShare?.(shareData)) {
    try {
      await navigator.share(shareData);
      return 'shared';
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return 'cancelled';
      }
      // Fall through to clipboard fallback on other errors
    }
  }

  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/**
 * Update the URL hash with puzzle and timeline parameters.
 * Does not trigger a page reload.
 *
 * @param puzzleId - The puzzle identifier
 * @param timelineId - The timeline/session identifier
 *
 * @example
 * ```typescript
 * updateUrlHash('nyt-2026-01-11', 'abc123xyz');
 * // URL becomes: https://example.com/#puzzle=nyt-2026-01-11&timeline=abc123xyz
 * ```
 */
export function updateUrlHash(puzzleId: string, timelineId: string): void {
  const newHash = `#puzzle=${encodeURIComponent(puzzleId)}&timeline=${timelineId}`;
  // Use replaceState to avoid adding to browser history
  window.history.replaceState(null, '', newHash);
}

/**
 * Clear the URL hash (remove puzzle and timeline parameters).
 * Does not trigger a page reload.
 *
 * @example
 * ```typescript
 * clearUrlHash();
 * // URL becomes: https://example.com/
 * ```
 */
export function clearUrlHash(): void {
  // Use replaceState to remove hash without page reload
  window.history.replaceState(null, '', window.location.pathname);
}
