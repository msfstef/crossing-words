/**
 * Service for fetching puzzles - tries direct fetch first, falls back to proxy
 */

import { getSource } from './sources';

// Read proxy URL from environment or fallback to deployed worker
const PROXY_URL =
  import.meta.env.VITE_PROXY_URL ||
  'https://crossing-words-proxy.msfstef.workers.dev';

/**
 * Try to fetch a puzzle directly from source
 * @returns ArrayBuffer if successful, null if blocked by CORS or failed
 */
async function tryDirectFetch(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return response.arrayBuffer();
  } catch {
    // CORS error or network failure - will fall back to proxy
    return null;
  }
}

/**
 * Fetch via CORS proxy
 */
async function fetchViaProxy(
  sourceId: string,
  date: Date
): Promise<ArrayBuffer> {
  const response = await fetch(`${PROXY_URL}/puzzle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: sourceId,
      date: date.toISOString(),
    }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Puzzle not found for this date');
    }
    if (response.status === 400) {
      throw new Error('Invalid source selected');
    }
    throw new Error(`Failed to fetch puzzle: ${response.statusText}`);
  }

  return response.arrayBuffer();
}

/**
 * Fetch a puzzle from a source - tries direct fetch first, falls back to proxy
 * @param sourceId The source identifier (e.g., 'universal')
 * @param date The date of the puzzle to fetch
 * @returns Promise resolving to the puzzle file bytes
 * @throws Error if the fetch fails
 */
export async function fetchPuzzle(
  sourceId: string,
  date: Date
): Promise<ArrayBuffer> {
  const source = getSource(sourceId);
  if (!source) {
    throw new Error('Invalid source selected');
  }

  // Try direct fetch first
  const directUrl = source.getDirectUrl(date);
  const directResult = await tryDirectFetch(directUrl);

  if (directResult) {
    console.log(`[fetchPuzzle] Direct fetch succeeded for ${sourceId}`);
    return directResult;
  }

  // Fall back to proxy
  console.log(
    `[fetchPuzzle] Direct fetch failed for ${sourceId}, trying proxy...`
  );
  return fetchViaProxy(sourceId, date);
}
