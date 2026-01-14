/**
 * React hook for managing pre-computed zoom zones.
 *
 * Computes zones once when the puzzle loads and provides
 * stable viewport lookups for zoom mode.
 */

import { useMemo, useCallback } from 'react';
import type { Puzzle, Clue } from '../types/puzzle';
import {
  computeZoomZoneMap,
  getViewportForClue,
  computeEdgeIndicators,
  type ZoomZoneMap,
  type ViewportBounds,
} from '../utils/zoomZones';

export interface UseZoomZonesReturn {
  /**
   * The computed zone map, or null if no puzzle loaded.
   */
  zoomZoneMap: ZoomZoneMap | null;

  /**
   * Get viewport bounds for a specific clue.
   */
  getViewportForClue: (clue: Clue) => ViewportBounds | null;

  /**
   * Get edge indicators for a viewport.
   * Returns which edges are internal (not at puzzle boundary).
   */
  getEdgeIndicators: (viewport: ViewportBounds) => {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  };
}

/**
 * Hook that pre-computes zoom zones for a puzzle.
 *
 * @param puzzle - The puzzle to compute zones for, or null
 * @returns Zone map and viewport lookup functions
 */
export function useZoomZones(puzzle: Puzzle | null): UseZoomZonesReturn {
  // Compute zone map once when puzzle changes
  const zoomZoneMap = useMemo(() => {
    if (!puzzle) return null;
    return computeZoomZoneMap(puzzle);
  }, [puzzle]);

  // Memoized viewport lookup
  const getViewportForClueFn = useCallback(
    (clue: Clue): ViewportBounds | null => {
      if (!zoomZoneMap || !puzzle) return null;
      return getViewportForClue(clue, zoomZoneMap, puzzle);
    },
    [zoomZoneMap, puzzle]
  );

  // Memoized edge indicator computation
  const getEdgeIndicators = useCallback(
    (viewport: ViewportBounds) => {
      if (!puzzle) {
        return { top: false, bottom: false, left: false, right: false };
      }
      return computeEdgeIndicators(viewport, puzzle);
    },
    [puzzle]
  );

  return {
    zoomZoneMap,
    getViewportForClue: getViewportForClueFn,
    getEdgeIndicators,
  };
}
