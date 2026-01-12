import './LoadingCard.css';

interface LoadingCardProps {
  title: string;
  source: string;
}

/**
 * Ghost/loading card displayed during puzzle download.
 * Shows a pulsing animation to indicate loading state.
 */
export function LoadingCard({ title, source }: LoadingCardProps) {
  return (
    <div className="loading-card">
      <div className="loading-card__content">
        <div className="loading-card__info">
          <span className="loading-card__title">{source}</span>
          {source !== title && (
            <span className="loading-card__subtitle">{title}</span>
          )}
        </div>

        <div className="loading-card__progress">
          <div className="loading-card__spinner" />
          <span className="loading-card__status">Downloading...</span>
        </div>
      </div>
    </div>
  );
}
