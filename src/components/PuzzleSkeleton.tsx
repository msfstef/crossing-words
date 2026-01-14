import './PuzzleSkeleton.css';

/**
 * Skeleton/ghost component displayed while puzzle is loading.
 * Matches the layout of the actual puzzle view to prevent layout shifts.
 */
export function PuzzleSkeleton() {
  return (
    <div className="puzzle-skeleton" aria-hidden="true">
      <div className="puzzle-skeleton__header">
        <div className="puzzle-skeleton__title" />
        <div className="puzzle-skeleton__author" />
      </div>

      <div className="puzzle-skeleton__grid-wrapper">
        <div className="puzzle-skeleton__grid" />
      </div>
    </div>
  );
}
