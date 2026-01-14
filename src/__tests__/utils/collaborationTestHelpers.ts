/**
 * Collaboration UI Test Helpers
 *
 * Utilities for testing collaboration UI components and hooks without
 * involving actual network connections. These helpers work with MockAwareness
 * to simulate various collaboration scenarios.
 *
 * Key features:
 * - Create mock collaborators with realistic data
 * - Simulate collaboration flows (join, leave, cursor movement)
 * - Test follow mode behavior
 * - Validate collaborator state in components
 *
 * @example Basic test setup
 * ```typescript
 * import { MockAwareness } from './MockAwareness';
 * import { createMockCollaborator, simulateCollaboratorJoin } from './collaborationTestHelpers';
 *
 * const awareness = new MockAwareness();
 * const alice = createMockCollaborator({ name: 'Alice' });
 * simulateCollaboratorJoin(awareness, alice);
 * ```
 */

import { MockAwareness, type MockCollaboratorData } from './MockAwareness';
import type { CursorPosition, UserInfo } from '../../collaboration/types';
import { PALETTE as COLLABORATOR_COLORS } from '../../collaboration/colors';

// ============================================================================
// Mock Data Generators
// ============================================================================

/**
 * Counter for generating unique client IDs
 */
let clientIdCounter = 100;

/**
 * Reset the client ID counter (useful between tests)
 */
export function resetClientIdCounter(): void {
  clientIdCounter = 100;
}

/**
 * Generate a unique client ID for a mock collaborator
 */
export function generateClientId(): number {
  return clientIdCounter++;
}

/**
 * Crossword-themed names for mock collaborators
 */
const MOCK_NAMES = [
  'Acrostic Alice',
  'Backward Bob',
  'Clue Carol',
  'Down Dave',
  'Enigma Eve',
  'Fill-in Frank',
  'Grid Grace',
  'Hint Henry',
  'Intersect Ivy',
  'Jumble Jack',
];

/**
 * Get a mock name by index (wraps around)
 */
export function getMockName(index: number): string {
  return MOCK_NAMES[index % MOCK_NAMES.length];
}

/**
 * Get a collaborator color by index (wraps around)
 */
export function getCollaboratorColor(index: number): string {
  return COLLABORATOR_COLORS[index % COLLABORATOR_COLORS.length];
}

/**
 * Options for creating a mock collaborator
 */
export interface MockCollaboratorOptions {
  /** Client ID (auto-generated if not provided) */
  clientId?: number;
  /** Display name (auto-generated if not provided) */
  name?: string;
  /** Highlight color (auto-generated if not provided) */
  color?: string;
  /** Avatar data URL (optional) */
  avatar?: string;
  /** Initial cursor position (optional, null = no cursor) */
  cursor?: CursorPosition | null;
  /** Client ID being followed (optional) */
  followingClientId?: number | null;
}

/**
 * Create mock collaborator data with sensible defaults.
 *
 * @param options - Optional overrides for collaborator properties
 * @returns Complete MockCollaboratorData ready for use with MockAwareness
 *
 * @example
 * ```typescript
 * // Create with defaults
 * const collab1 = createMockCollaborator();
 *
 * // Create with specific properties
 * const collab2 = createMockCollaborator({
 *   name: 'Alice',
 *   cursor: { row: 5, col: 3, direction: 'across' }
 * });
 * ```
 */
export function createMockCollaborator(options: MockCollaboratorOptions = {}): MockCollaboratorData {
  const clientId = options.clientId ?? generateClientId();
  const index = clientId - 100; // Use clientId offset for consistent naming/coloring

  return {
    clientId,
    user: {
      name: options.name ?? getMockName(index),
      color: options.color ?? getCollaboratorColor(index),
      avatar: options.avatar,
    },
    cursor: options.cursor ?? null,
    followingClientId: options.followingClientId,
  };
}

/**
 * Create multiple mock collaborators at once.
 *
 * @param count - Number of collaborators to create
 * @param baseOptions - Options to apply to all collaborators
 * @returns Array of MockCollaboratorData
 *
 * @example
 * ```typescript
 * // Create 3 collaborators with cursors
 * const collaborators = createMockCollaborators(3, {
 *   cursor: { row: 0, col: 0, direction: 'across' }
 * });
 * ```
 */
export function createMockCollaborators(
  count: number,
  baseOptions: Omit<MockCollaboratorOptions, 'clientId'> = {}
): MockCollaboratorData[] {
  return Array.from({ length: count }, () => createMockCollaborator(baseOptions));
}

// ============================================================================
// Simulation Helpers
// ============================================================================

/**
 * Simulate a collaborator joining the session.
 *
 * @param awareness - MockAwareness instance
 * @param collaborator - Collaborator data (or options to create one)
 * @returns The added collaborator's client ID
 *
 * @example
 * ```typescript
 * const awareness = new MockAwareness();
 *
 * // Add with full data
 * const alice = createMockCollaborator({ name: 'Alice' });
 * simulateCollaboratorJoin(awareness, alice);
 *
 * // Or create inline
 * simulateCollaboratorJoin(awareness, { name: 'Bob' });
 * ```
 */
export function simulateCollaboratorJoin(
  awareness: MockAwareness,
  collaborator: MockCollaboratorData | MockCollaboratorOptions
): number {
  const data = 'user' in collaborator ? collaborator : createMockCollaborator(collaborator);
  return awareness.addCollaborator(data);
}

/**
 * Simulate a collaborator leaving the session.
 *
 * @param awareness - MockAwareness instance
 * @param clientId - The client ID to remove
 * @returns True if the collaborator was removed
 *
 * @example
 * ```typescript
 * simulateCollaboratorLeave(awareness, 101);
 * ```
 */
export function simulateCollaboratorLeave(awareness: MockAwareness, clientId: number): boolean {
  return awareness.removeCollaborator(clientId);
}

/**
 * Simulate a collaborator moving their cursor.
 *
 * @param awareness - MockAwareness instance
 * @param clientId - The collaborator's client ID
 * @param cursor - New cursor position (or null to clear)
 *
 * @example
 * ```typescript
 * simulateCursorMove(awareness, 101, { row: 5, col: 3, direction: 'across' });
 * ```
 */
export function simulateCursorMove(
  awareness: MockAwareness,
  clientId: number,
  cursor: CursorPosition | null
): void {
  awareness.updateCollaboratorCursor(clientId, cursor);
}

/**
 * Simulate a collaborator typing in a cell (cursor moves forward).
 *
 * @param awareness - MockAwareness instance
 * @param clientId - The collaborator's client ID
 *
 * @example
 * ```typescript
 * // Start at (0, 0) across
 * simulateCursorMove(awareness, 101, { row: 0, col: 0, direction: 'across' });
 * // Type and advance
 * simulateTyping(awareness, 101); // Now at (0, 1)
 * ```
 */
export function simulateTyping(awareness: MockAwareness, clientId: number): void {
  const state = awareness.getCollaboratorState(clientId);
  if (!state?.cursor) return;

  const { row, col, direction } = state.cursor;
  const newCursor: CursorPosition = direction === 'across'
    ? { row, col: col + 1, direction }
    : { row: row + 1, col, direction };

  awareness.updateCollaboratorCursor(clientId, newCursor);
}

/**
 * Simulate multiple collaborators joining at once.
 *
 * @param awareness - MockAwareness instance
 * @param count - Number of collaborators to add
 * @param baseOptions - Options for all collaborators
 * @returns Array of client IDs
 *
 * @example
 * ```typescript
 * const clientIds = simulateMultipleJoins(awareness, 5);
 * ```
 */
export function simulateMultipleJoins(
  awareness: MockAwareness,
  count: number,
  baseOptions: Omit<MockCollaboratorOptions, 'clientId'> = {}
): number[] {
  const collaborators = createMockCollaborators(count, baseOptions);
  return collaborators.map(c => awareness.addCollaborator(c));
}

// ============================================================================
// State Verification Helpers
// ============================================================================

/**
 * Get the current number of collaborators (excluding local client).
 *
 * @param awareness - MockAwareness instance
 * @returns Number of remote collaborators
 */
export function getCollaboratorCount(awareness: MockAwareness): number {
  return awareness.getCollaboratorIds().length;
}

/**
 * Check if a specific collaborator exists in awareness.
 *
 * @param awareness - MockAwareness instance
 * @param clientId - Client ID to check
 * @returns True if the collaborator exists
 */
export function hasCollaborator(awareness: MockAwareness, clientId: number): boolean {
  return awareness.getCollaboratorIds().includes(clientId);
}

/**
 * Get a collaborator's current cursor position.
 *
 * @param awareness - MockAwareness instance
 * @param clientId - Client ID to check
 * @returns Cursor position or null
 */
export function getCollaboratorCursor(
  awareness: MockAwareness,
  clientId: number
): CursorPosition | null {
  return awareness.getCollaboratorState(clientId)?.cursor ?? null;
}

/**
 * Check if any collaborator has cursor at a specific position.
 *
 * @param awareness - MockAwareness instance
 * @param position - Position to check (row, col)
 * @returns True if any collaborator's cursor is at this position
 */
export function hasCollaboratorAtPosition(
  awareness: MockAwareness,
  position: { row: number; col: number }
): boolean {
  for (const clientId of awareness.getCollaboratorIds()) {
    const cursor = awareness.getCollaboratorState(clientId)?.cursor;
    if (cursor && cursor.row === position.row && cursor.col === position.col) {
      return true;
    }
  }
  return false;
}

/**
 * Get all collaborators at a specific cell position.
 *
 * @param awareness - MockAwareness instance
 * @param position - Position to check (row, col)
 * @returns Array of client IDs at this position
 */
export function getCollaboratorsAtPosition(
  awareness: MockAwareness,
  position: { row: number; col: number }
): number[] {
  const result: number[] = [];
  for (const clientId of awareness.getCollaboratorIds()) {
    const cursor = awareness.getCollaboratorState(clientId)?.cursor;
    if (cursor && cursor.row === position.row && cursor.col === position.col) {
      result.push(clientId);
    }
  }
  return result;
}

// ============================================================================
// Scenario Setup Helpers
// ============================================================================

/**
 * Set up a basic collaboration scenario with local user and collaborators.
 *
 * @param options - Scenario configuration
 * @returns MockAwareness with configured state
 *
 * @example
 * ```typescript
 * const awareness = setupCollaborationScenario({
 *   localUser: { name: 'Me', color: '#4F46E5' },
 *   collaborators: [
 *     { name: 'Alice', cursor: { row: 0, col: 0, direction: 'across' } },
 *     { name: 'Bob', cursor: { row: 5, col: 5, direction: 'down' } },
 *   ]
 * });
 * ```
 */
export function setupCollaborationScenario(options: {
  localUser?: Partial<UserInfo>;
  localCursor?: CursorPosition | null;
  collaborators?: MockCollaboratorOptions[];
}): MockAwareness {
  const awareness = new MockAwareness();

  // Set local user state if provided
  if (options.localUser || options.localCursor !== undefined) {
    awareness.setLocalState({
      user: {
        name: options.localUser?.name ?? 'Local User',
        color: options.localUser?.color ?? '#4F46E5',
        avatar: options.localUser?.avatar,
      },
      cursor: options.localCursor ?? null,
    });
  }

  // Add collaborators
  if (options.collaborators) {
    for (const collabOptions of options.collaborators) {
      simulateCollaboratorJoin(awareness, collabOptions);
    }
  }

  return awareness;
}

/**
 * Set up a scenario with overlapping cursors (multiple users on same cell).
 *
 * @param position - The cell position where cursors overlap
 * @param count - Number of collaborators (default: 2)
 * @returns MockAwareness with overlapping cursors
 *
 * @example
 * ```typescript
 * const awareness = setupOverlappingCursors({ row: 5, col: 3 }, 3);
 * // Now 3 collaborators all have cursor at (5, 3)
 * ```
 */
export function setupOverlappingCursors(
  position: { row: number; col: number; direction?: 'across' | 'down' },
  count: number = 2
): MockAwareness {
  const awareness = new MockAwareness();
  const cursor: CursorPosition = {
    row: position.row,
    col: position.col,
    direction: position.direction ?? 'across',
  };

  for (let i = 0; i < count; i++) {
    simulateCollaboratorJoin(awareness, { cursor });
  }

  return awareness;
}

/**
 * Set up a follow mode scenario.
 *
 * @param options - Follow scenario options
 * @returns MockAwareness configured for follow mode testing
 *
 * @example
 * ```typescript
 * const awareness = setupFollowScenario({
 *   leader: { name: 'Leader', cursor: { row: 0, col: 0, direction: 'across' } },
 *   followerCount: 2,
 * });
 * ```
 */
export function setupFollowScenario(options: {
  leader: MockCollaboratorOptions;
  followerCount?: number;
}): { awareness: MockAwareness; leaderId: number; followerIds: number[] } {
  const awareness = new MockAwareness();

  // Add leader
  const leaderId = simulateCollaboratorJoin(awareness, options.leader);

  // Add followers (who follow the leader)
  const followerIds: number[] = [];
  const followerCount = options.followerCount ?? 1;
  for (let i = 0; i < followerCount; i++) {
    const followerId = simulateCollaboratorJoin(awareness, {
      followingClientId: leaderId,
    });
    followerIds.push(followerId);
  }

  return { awareness, leaderId, followerIds };
}

// ============================================================================
// Wait Helpers (for async testing)
// ============================================================================

/**
 * Wait for awareness to have expected number of collaborators.
 *
 * @param awareness - MockAwareness instance
 * @param expectedCount - Expected number of collaborators
 * @param timeout - Timeout in milliseconds (default: 1000)
 */
export async function waitForCollaboratorCount(
  awareness: MockAwareness,
  expectedCount: number,
  timeout: number = 1000
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check immediately
    if (getCollaboratorCount(awareness) === expectedCount) {
      resolve();
      return;
    }

    // Set up listener
    const checkCount = () => {
      if (getCollaboratorCount(awareness) === expectedCount) {
        awareness.off('change', checkCount);
        resolve();
      }
    };

    awareness.on('change', checkCount);

    // Timeout
    setTimeout(() => {
      awareness.off('change', checkCount);
      if (getCollaboratorCount(awareness) !== expectedCount) {
        reject(new Error(
          `Timeout waiting for ${expectedCount} collaborators. Current: ${getCollaboratorCount(awareness)}`
        ));
      }
    }, timeout);
  });
}

// ============================================================================
// Exports
// ============================================================================

export { MockAwareness } from './MockAwareness';
