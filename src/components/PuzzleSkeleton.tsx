import { useMemo } from 'react';
import { computeGridDimensions, DEFAULT_PUZZLE_DIMENSIONS } from '../lib/gridSizing';
import './PuzzleSkeleton.css';

interface PuzzleSkeletonProps {
  /** Number of columns in the puzzle grid */
  cols?: number;
  /** Number of rows in the puzzle grid */
  rows?: number;
  /** Whether the device supports touch (affects keyboard visibility) */
  isTouchDevice?: boolean;
}

/**
 * Skeleton/ghost component displayed while puzzle is loading.
 *
 * When puzzle dimensions are provided, renders at the exact same size
 * as the actual CrosswordGrid will render - preventing layout shift.
 *
 * When dimensions are unknown, uses standard 15x15 size as default.
 */
export function PuzzleSkeleton({
  cols = DEFAULT_PUZZLE_DIMENSIONS.cols,
  rows = DEFAULT_PUZZLE_DIMENSIONS.rows,
  isTouchDevice = false,
}: PuzzleSkeletonProps) {
  // Compute exact grid dimensions matching what CrosswordGrid will render
  const gridDimensions = useMemo(() => {
    return computeGridDimensions(cols, rows, isTouchDevice);
  }, [cols, rows, isTouchDevice]);

  return (
    <div className="puzzle-skeleton" aria-hidden="true">
      <div className="puzzle-skeleton__header">
        <div className="puzzle-skeleton__title" />
        <div className="puzzle-skeleton__author" />
      </div>

      <div className="puzzle-skeleton__grid-wrapper">
        <div
          className="puzzle-skeleton__grid"
          style={{
            width: gridDimensions.gridWidth,
            height: gridDimensions.gridHeight,
          }}
        />
      </div>
    </div>
  );
}
