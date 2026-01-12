import type { ReactNode } from 'react';
import type { Collaborator } from '../../collaboration/types';
import type { ConnectionState } from '../../crdt/webrtcProvider';
import './SolveHeader.css';

interface SolveHeaderProps {
  /** Puzzle title */
  puzzleTitle: string;
  /** Formatted display date (optional) */
  puzzleDate?: string;
  /** Back button handler */
  onBack: () => void;
  /** Share button handler */
  onShare: () => void;
  /** Menu button handler */
  onMenuClick: () => void;
  /** List of connected collaborators */
  collaborators: Collaborator[];
  /** Toolbar dropdown menus (Check/Reveal) */
  menuContent: ReactNode;
  /** P2P connection state */
  connectionState: ConnectionState;
  /** Whether we're in a P2P session */
  isP2PSession: boolean;
  /** Whether the device is online */
  isOnline: boolean;
}

/**
 * Compact header for the puzzle solving view.
 * Layout: Back | Puzzle Info | Collaborators | Connection | Share | Menu
 */
export function SolveHeader({
  puzzleTitle,
  puzzleDate,
  onBack,
  onShare,
  collaborators,
  menuContent,
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

      {/* Puzzle info - title and optional date */}
      <div className="solve-header__info">
        <span className="solve-header__title">{puzzleTitle}</span>
        {puzzleDate && (
          <>
            <span className="solve-header__separator">•</span>
            <span className="solve-header__date">{puzzleDate}</span>
          </>
        )}
      </div>

      {/* Spacer */}
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

      {/* Share button - icon only on mobile */}
      <button
        type="button"
        className="solve-header__share"
        onClick={onShare}
        aria-label="Share puzzle"
      >
        <span className="solve-header__share-icon">↗</span>
        <span className="solve-header__share-text">Share</span>
      </button>

      {/* Menu area - contains toolbar dropdowns */}
      <div className="solve-header__menu">
        {menuContent}
      </div>
    </header>
  );
}
