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

      {/* Connection indicator - show in P2P mode */}
      {isP2PSession && (
        <div className={`solve-header__connection solve-header__connection--${connectionState}`}>
          {connectionState === 'connecting' && (
            <>
              <span className="solve-header__connection-spinner" />
              <span>Connecting</span>
            </>
          )}
          {connectionState === 'connected' && <span>Connected</span>}
        </div>
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
