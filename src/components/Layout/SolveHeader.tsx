import type { ReactNode } from 'react';
import type { Collaborator } from '../../collaboration/types';
import './SolveHeader.css';

interface SolveHeaderProps {
  /** Back button handler */
  onBack: () => void;
  /** Share button handler */
  onShare: () => void;
  /** List of connected collaborators */
  collaborators: Collaborator[];
  /** Settings menu component */
  settingsMenu: ReactNode;
  /** The collaborator currently being followed, or null if not following */
  followedCollaborator?: Collaborator | null;
  /** Toggle follow mode */
  onToggleFollow?: () => void;
}

/**
 * Compact header for the puzzle solving view.
 * Layout: Back | Spacer | Collaborators | Follow | Share | Settings
 */
export function SolveHeader({
  onBack,
  onShare,
  collaborators,
  settingsMenu,
  followedCollaborator = null,
  onToggleFollow,
}: SolveHeaderProps) {
  return (
    <header className="solve-header">
      {/* Back button */}
      <button
        type="button"
        className="solve-header__back"
        onClick={onBack}
        aria-label="Back to library"
      >
        <svg className="solve-header__back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {/* Spacer - header title removed, now shown above grid */}
      <div className="solve-header__spacer" />

      {/* Collaborator dots - compact overlapping avatars */}
      {collaborators.length > 0 && (
        <div className="solve-header__collaborators">
          {collaborators.slice(0, 5).map((collab) => (
            <div
              key={collab.clientId}
              className="solve-header__avatar"
              style={{
                borderColor: collab.user.color,
                backgroundColor: collab.user.avatar ? 'transparent' : collab.user.color,
              }}
              title={collab.user.name}
            >
              {collab.user.avatar && (
                <img
                  src={collab.user.avatar}
                  alt=""
                  className="solve-header__avatar-image"
                />
              )}
            </div>
          ))}
          {collaborators.length > 5 && (
            <div className="solve-header__avatar solve-header__avatar--overflow">
              +{collaborators.length - 5}
            </div>
          )}
        </div>
      )}

      {/* Follow button - show when there are collaborators */}
      {collaborators.length > 0 && onToggleFollow && (
        <button
          type="button"
          className={`solve-header__follow ${followedCollaborator ? 'solve-header__follow--active' : ''}`}
          onClick={onToggleFollow}
          aria-label={followedCollaborator ? `Following ${followedCollaborator.user.name}` : 'Follow a collaborator'}
          title={followedCollaborator ? `Following ${followedCollaborator.user.name}` : 'Follow a collaborator'}
          style={followedCollaborator ? { borderColor: followedCollaborator.user.color } : undefined}
        >
          <svg
            className="solve-header__follow-icon"
            viewBox="0 0 24 24"
            fill={followedCollaborator ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Eye icon */}
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      )}

      {/* Share button - neutral styling with share icon */}
      <button
        type="button"
        className="solve-header__share"
        onClick={onShare}
        aria-label="Share puzzle"
        title="Share puzzle"
      >
        <svg
          className="solve-header__share-svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      </button>

      {/* Settings menu */}
      {settingsMenu}
    </header>
  );
}
