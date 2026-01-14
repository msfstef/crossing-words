/**
 * MockAwareness - A mock implementation of Yjs Awareness for testing.
 *
 * This class provides a standalone Awareness-like object that can be used
 * to test collaboration UI components and hooks without requiring actual
 * network connections or WebRTC.
 *
 * Features:
 * - Emulates the Yjs Awareness API (getStates, setLocalState, on, off, etc.)
 * - Supports programmatic addition/removal of collaborators
 * - Emits 'change' events like real Awareness
 * - Allows simulating various collaboration scenarios
 *
 * @example Basic usage
 * ```typescript
 * const awareness = new MockAwareness();
 *
 * // Add a collaborator
 * awareness.addCollaborator({
 *   clientId: 2,
 *   user: { name: 'Alice', color: '#ff6b6b' },
 *   cursor: { row: 5, col: 3, direction: 'across' }
 * });
 *
 * // Use with hooks
 * const { result } = renderHook(() => useCollaborators(awareness));
 * expect(result.current).toHaveLength(1);
 * ```
 */

import type { Awareness } from 'y-protocols/awareness';
import type { CollaboratorState, CursorPosition, UserInfo } from '../../collaboration/types';

/**
 * Event handler types for Awareness events
 */
type ChangeHandler = (changes: { added: number[]; updated: number[]; removed: number[] }) => void;
type UpdateHandler = () => void;

/**
 * Collaborator data for MockAwareness
 */
export interface MockCollaboratorData {
  clientId: number;
  user: UserInfo;
  cursor: CursorPosition | null;
  followingClientId?: number | null;
}

/**
 * MockAwareness implementation
 *
 * Provides a testing-friendly implementation of Yjs Awareness that doesn't
 * require network connectivity. Useful for unit testing collaboration UI
 * components and hooks.
 */
export class MockAwareness implements Pick<Awareness, 'clientID' | 'getStates' | 'setLocalState' | 'setLocalStateField' | 'on' | 'off'> {
  /** Local client ID (simulated) */
  public readonly clientID: number;

  /** Internal state storage */
  private states: Map<number, CollaboratorState>;

  /** Event handlers */
  private changeHandlers: Set<ChangeHandler>;
  private updateHandlers: Set<UpdateHandler>;

  /**
   * Create a new MockAwareness instance
   * @param localClientId - Optional client ID for the local user (defaults to 1)
   */
  constructor(localClientId: number = 1) {
    this.clientID = localClientId;
    this.states = new Map();
    this.changeHandlers = new Set();
    this.updateHandlers = new Set();
  }

  /**
   * Get all awareness states (same API as real Awareness)
   */
  getStates(): Map<number, CollaboratorState> {
    return new Map(this.states);
  }

  /**
   * Set the local user's state (same API as real Awareness)
   */
  setLocalState(state: CollaboratorState | null): void {
    if (state === null) {
      const existed = this.states.has(this.clientID);
      this.states.delete(this.clientID);
      if (existed) {
        this.emitChange({ added: [], updated: [], removed: [this.clientID] });
      }
    } else {
      const isNew = !this.states.has(this.clientID);
      this.states.set(this.clientID, state);
      this.emitChange({
        added: isNew ? [this.clientID] : [],
        updated: isNew ? [] : [this.clientID],
        removed: []
      });
    }
  }

  /**
   * Set a field on the local user's state (same API as real Awareness)
   */
  setLocalStateField(field: string, value: unknown): void {
    const currentState = this.states.get(this.clientID) ?? { user: { name: '', color: '' }, cursor: null };
    const newState = { ...currentState, [field]: value };
    this.setLocalState(newState);
  }

  /**
   * Subscribe to events (same API as real Awareness)
   */
  on(event: 'change', handler: ChangeHandler): void;
  on(event: 'update', handler: UpdateHandler): void;
  on(event: string, handler: ChangeHandler | UpdateHandler): void {
    if (event === 'change') {
      this.changeHandlers.add(handler as ChangeHandler);
    } else if (event === 'update') {
      this.updateHandlers.add(handler as UpdateHandler);
    }
  }

  /**
   * Unsubscribe from events (same API as real Awareness)
   */
  off(event: 'change', handler: ChangeHandler): void;
  off(event: 'update', handler: UpdateHandler): void;
  off(event: string, handler: ChangeHandler | UpdateHandler): void {
    if (event === 'change') {
      this.changeHandlers.delete(handler as ChangeHandler);
    } else if (event === 'update') {
      this.updateHandlers.delete(handler as UpdateHandler);
    }
  }

  // ============================================================================
  // Test Helper Methods (not part of real Awareness API)
  // ============================================================================

  /**
   * Add a collaborator to the awareness state.
   * This simulates another user joining the session.
   *
   * @param data - Collaborator data including clientId, user info, and cursor
   * @returns The client ID of the added collaborator
   *
   * @example
   * ```typescript
   * awareness.addCollaborator({
   *   clientId: 2,
   *   user: { name: 'Alice', color: '#ff6b6b' },
   *   cursor: { row: 5, col: 3, direction: 'across' }
   * });
   * ```
   */
  addCollaborator(data: MockCollaboratorData): number {
    const { clientId, user, cursor, followingClientId } = data;

    if (clientId === this.clientID) {
      throw new Error(`Cannot add collaborator with local client ID ${this.clientID}`);
    }

    const isNew = !this.states.has(clientId);
    this.states.set(clientId, { user, cursor, followingClientId });

    this.emitChange({
      added: isNew ? [clientId] : [],
      updated: isNew ? [] : [clientId],
      removed: []
    });

    return clientId;
  }

  /**
   * Remove a collaborator from the awareness state.
   * This simulates another user leaving the session.
   *
   * @param clientId - The client ID to remove
   * @returns True if the collaborator was removed, false if not found
   *
   * @example
   * ```typescript
   * awareness.removeCollaborator(2);
   * ```
   */
  removeCollaborator(clientId: number): boolean {
    if (!this.states.has(clientId)) {
      return false;
    }

    this.states.delete(clientId);
    this.emitChange({ added: [], updated: [], removed: [clientId] });
    return true;
  }

  /**
   * Update a collaborator's cursor position.
   *
   * @param clientId - The client ID to update
   * @param cursor - New cursor position (or null to clear)
   *
   * @example
   * ```typescript
   * awareness.updateCollaboratorCursor(2, { row: 10, col: 7, direction: 'down' });
   * ```
   */
  updateCollaboratorCursor(clientId: number, cursor: CursorPosition | null): void {
    const state = this.states.get(clientId);
    if (!state) {
      throw new Error(`Collaborator ${clientId} not found`);
    }

    this.states.set(clientId, { ...state, cursor });
    this.emitChange({ added: [], updated: [clientId], removed: [] });
  }

  /**
   * Update a collaborator's user info.
   *
   * @param clientId - The client ID to update
   * @param user - Partial user info to merge
   *
   * @example
   * ```typescript
   * awareness.updateCollaboratorUser(2, { name: 'Alice (Away)' });
   * ```
   */
  updateCollaboratorUser(clientId: number, user: Partial<UserInfo>): void {
    const state = this.states.get(clientId);
    if (!state) {
      throw new Error(`Collaborator ${clientId} not found`);
    }

    this.states.set(clientId, {
      ...state,
      user: { ...state.user, ...user }
    });
    this.emitChange({ added: [], updated: [clientId], removed: [] });
  }

  /**
   * Get a specific collaborator's state.
   *
   * @param clientId - The client ID to get
   * @returns The collaborator state, or undefined if not found
   */
  getCollaboratorState(clientId: number): CollaboratorState | undefined {
    return this.states.get(clientId);
  }

  /**
   * Get all collaborator IDs (excluding local client).
   */
  getCollaboratorIds(): number[] {
    return Array.from(this.states.keys()).filter(id => id !== this.clientID);
  }

  /**
   * Clear all collaborators (except local state).
   */
  clearCollaborators(): void {
    const removed = this.getCollaboratorIds();
    for (const id of removed) {
      this.states.delete(id);
    }
    if (removed.length > 0) {
      this.emitChange({ added: [], updated: [], removed });
    }
  }

  /**
   * Reset the entire awareness state including local state.
   */
  reset(): void {
    const removed = Array.from(this.states.keys());
    this.states.clear();
    if (removed.length > 0) {
      this.emitChange({ added: [], updated: [], removed });
    }
  }

  /**
   * Emit a change event to all handlers
   */
  private emitChange(changes: { added: number[]; updated: number[]; removed: number[] }): void {
    // Only emit if there are actual changes
    if (changes.added.length === 0 && changes.updated.length === 0 && changes.removed.length === 0) {
      return;
    }

    for (const handler of this.changeHandlers) {
      handler(changes);
    }
    for (const handler of this.updateHandlers) {
      handler();
    }
  }
}
