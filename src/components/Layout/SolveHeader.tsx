import type { ReactNode } from 'react';
import type { Collaborator } from '../../collaboration/types';
import type { ConnectionState } from '../../crdt/webrtcProvider';
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
  /** P2P connection state */
  connectionState: ConnectionState;
  /** Whether we're in a P2P session */
  isP2PSession: boolean;
  /** Whether the device is online */
  isOnline: boolean;
}

/**
 * Compact header for the puzzle solving view.
 * Layout: Back | Spacer | Collaborators | Connection | Share | Settings
 */
export function SolveHeader({
  onBack,
  onShare,
  collaborators,
  settingsMenu,
  connectionState,
  isP2PSession,
  isOnline,
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
        ←
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
              style={{ backgroundColor: collab.user.color }}
              title={collab.user.name}
            />
          ))}
          {collaborators.length > 5 && (
            <div className="solve-header__avatar solve-header__avatar--overflow">
              +{collaborators.length - 5}
            </div>
          )}
        </div>
      )}

      {/* Offline indicator - only show when offline */}
      {!isOnline && (
        <div className="solve-header__offline" title="You are offline">
          <span className="solve-header__offline-text">Offline</span>
        </div>
      )}

      {/* Connection indicator - only show in P2P mode and when online */}
      {isP2PSession && isOnline && (
        <div
          className={`solve-header__connection solve-header__connection--${connectionState}`}
          title={`${connectionState.charAt(0).toUpperCase() + connectionState.slice(1)}`}
        />
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
