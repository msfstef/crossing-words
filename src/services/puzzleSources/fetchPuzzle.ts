/**
 * Service for fetching puzzles via the CORS proxy
 */

// Read proxy URL from environment or fallback to deployed worker
const PROXY_URL =
  import.meta.env.VITE_PROXY_URL || 'https://crossing-words-proxy.workers.dev';

/**
 * Fetch a puzzle from a source via the proxy
 * @param sourceId The source identifier (e.g., 'universal')
 * @param date The date of the puzzle to fetch
 * @returns Promise resolving to the puzzle file bytes
 * @throws Error if the fetch fails
 */
export async function fetchPuzzle(
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
