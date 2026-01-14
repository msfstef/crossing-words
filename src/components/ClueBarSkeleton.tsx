import './ClueBarSkeleton.css';

/**
 * Skeleton/ghost component for ClueBar during loading.
 * Matches exact dimensions of ClueBar (56px height, max-width 500px).
 */
export function ClueBarSkeleton() {
  return (
    <div className="clue-bar-skeleton" aria-hidden="true">
      <div className="clue-bar-skeleton__nav" />
      <div className="clue-bar-skeleton__content">
        <div className="clue-bar-skeleton__text" />
      </div>
      <div className="clue-bar-skeleton__nav" />
    </div>
  );
}
