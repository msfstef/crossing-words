import './SkeletonCard.css';

/**
 * Skeleton/ghost card displayed during initial library load.
 * Matches the layout of PuzzleCard to prevent layout shifts.
 */
export function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton-card__content">
        <div className="skeleton-card__info">
          <div className="skeleton-card__title" />
          <div className="skeleton-card__subtitle" />
        </div>

        <div className="skeleton-card__progress" />
      </div>

      {/* Spacer to match PuzzleCard delete button width */}
      <div className="skeleton-card__spacer" />
    </div>
  );
}
