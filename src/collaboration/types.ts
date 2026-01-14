/**
 * Type definitions for collaboration and presence tracking.
 *
 * These types define the structure of awareness state shared between peers
 * via the Yjs Awareness protocol.
 */

/**
 * Cursor position in the puzzle grid with direction.
 */
export interface CursorPosition {
  row: number;
  col: number;
  direction: 'across' | 'down';
}

/**
 * User information for display in presence UI.
 */
export interface UserInfo {
  /** Display name (auto-generated nickname) */
  name: string;
  /** Hex color for highlighting (e.g., "#ff6b6b") */
  color: string;
}

/**
 * Full collaborator state stored in Yjs Awareness.
 * This is the shape of data shared with other peers.
 */
export interface CollaboratorState {
  /** User display information */
  user: UserInfo;
  /** Current cursor position, null if not focused on puzzle */
  cursor: CursorPosition | null;
  /** Client ID of the collaborator being followed, null if not following anyone */
  followingClientId?: number | null;
}

/**
 * Collaborator with their client ID for identification.
 * Used in the useCollaborators hook return type.
 */
export interface Collaborator {
  /** Unique client ID from Yjs Awareness */
  clientId: number;
  /** User display information */
  user: UserInfo;
  /** Current cursor position, null if not focused */
  cursor: CursorPosition | null;
}

/**
 * Local user info for setting initial awareness state.
 * Used when creating a P2P session.
 */
export type LocalUserInfo = UserInfo;
