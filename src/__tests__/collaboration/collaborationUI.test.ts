/**
 * Collaboration UI Tests
 *
 * These tests demonstrate how to use the collaboration test utilities
 * to test collaboration UI components and hooks WITHOUT requiring
 * actual network connections.
 *
 * Key patterns demonstrated:
 * - Using MockAwareness for hook testing
 * - Creating mock collaborators with realistic data
 * - Simulating collaboration flows (join, leave, move)
 * - Testing overlapping cursors and follow mode
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCollaborators } from '../../collaboration/useCollaborators';
import {
  MockAwareness,
  createMockCollaborator,
  createMockCollaborators,
  simulateCollaboratorJoin,
  simulateCollaboratorLeave,
  simulateCursorMove,
  simulateTyping,
  simulateMultipleJoins,
  getCollaboratorCount,
  hasCollaborator,
  getCollaboratorCursor,
  hasCollaboratorAtPosition,
  getCollaboratorsAtPosition,
  setupCollaborationScenario,
  setupOverlappingCursors,
  setupFollowScenario,
  resetClientIdCounter,
} from '../utils/collaborationTestHelpers';

describe('Collaboration UI Testing', () => {
  beforeEach(() => {
    // Reset client ID counter for predictable IDs in tests
    resetClientIdCounter();
  });

  // ============================================================================
  // MockAwareness Basic Tests
  // ============================================================================

  describe('MockAwareness', () => {
    it('should create with default local client ID', () => {
      const awareness = new MockAwareness();
      expect(awareness.clientID).toBe(1);
    });

    it('should create with custom local client ID', () => {
      const awareness = new MockAwareness(42);
      expect(awareness.clientID).toBe(42);
    });

    it('should start with empty state', () => {
      const awareness = new MockAwareness();
      expect(awareness.getStates().size).toBe(0);
    });

    it('should set and get local state', () => {
      const awareness = new MockAwareness();
      awareness.setLocalState({
        user: { name: 'Test User', color: '#ff0000' },
        cursor: { row: 5, col: 3, direction: 'across' },
      });

      const state = awareness.getStates().get(awareness.clientID);
      expect(state?.user.name).toBe('Test User');
      expect(state?.cursor?.row).toBe(5);
    });

    it('should emit change event when state changes', () => {
      const awareness = new MockAwareness();
      const handler = vi.fn();
      awareness.on('change', handler);

      awareness.addCollaborator({
        clientId: 2,
        user: { name: 'Alice', color: '#ff6b6b' },
        cursor: null,
      });

      expect(handler).toHaveBeenCalledWith({
        added: [2],
        updated: [],
        removed: [],
      });
    });
  });

  // ============================================================================
  // useCollaborators Hook Tests
  // ============================================================================

  describe('useCollaborators hook with MockAwareness', () => {
    let awareness: MockAwareness;

    beforeEach(() => {
      awareness = new MockAwareness();
    });

    it('should return empty array when no collaborators', () => {
      const { result } = renderHook(() => useCollaborators(awareness));
      expect(result.current).toEqual([]);
    });

    it('should return collaborators when they join', () => {
      const { result } = renderHook(() => useCollaborators(awareness));

      act(() => {
        simulateCollaboratorJoin(awareness, { name: 'Alice' });
      });

      expect(result.current).toHaveLength(1);
      expect(result.current[0].user.name).toBe('Alice');
    });

    it('should exclude local client from collaborators', () => {
      const { result } = renderHook(() => useCollaborators(awareness));

      // Set local state
      act(() => {
        awareness.setLocalState({
          user: { name: 'Me', color: '#4F46E5' },
          cursor: null,
        });
      });

      // Local user should not appear in collaborators
      expect(result.current).toHaveLength(0);

      // Add remote collaborator
      act(() => {
        simulateCollaboratorJoin(awareness, { name: 'Alice' });
      });

      expect(result.current).toHaveLength(1);
      expect(result.current[0].user.name).toBe('Alice');
    });

    it('should update when collaborator cursor moves', () => {
      const { result } = renderHook(() => useCollaborators(awareness));

      let clientId: number;
      act(() => {
        clientId = simulateCollaboratorJoin(awareness, {
          name: 'Alice',
          cursor: { row: 0, col: 0, direction: 'across' },
        });
      });

      expect(result.current[0].cursor?.row).toBe(0);
      expect(result.current[0].cursor?.col).toBe(0);

      act(() => {
        simulateCursorMove(awareness, clientId!, { row: 5, col: 3, direction: 'down' });
      });

      expect(result.current[0].cursor?.row).toBe(5);
      expect(result.current[0].cursor?.col).toBe(3);
      expect(result.current[0].cursor?.direction).toBe('down');
    });

    it('should remove collaborator when they leave', () => {
      const { result } = renderHook(() => useCollaborators(awareness));

      let clientId: number;
      act(() => {
        clientId = simulateCollaboratorJoin(awareness, { name: 'Alice' });
      });

      expect(result.current).toHaveLength(1);

      act(() => {
        simulateCollaboratorLeave(awareness, clientId!);
      });

      expect(result.current).toHaveLength(0);
    });

    it('should handle multiple collaborators', () => {
      const { result } = renderHook(() => useCollaborators(awareness));

      act(() => {
        simulateMultipleJoins(awareness, 5);
      });

      expect(result.current).toHaveLength(5);
      // Verify each has unique clientId and name
      const names = result.current.map(c => c.user.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(5);
    });

    it('should call notify on join/leave when provided', () => {
      const notify = vi.fn();
      renderHook(() => useCollaborators(awareness, { notify }));

      // First change is initial load, should not notify
      let clientId: number;
      act(() => {
        clientId = simulateCollaboratorJoin(awareness, { name: 'Alice' });
      });

      // Wait for initial load flag to clear, then trigger another change
      act(() => {
        simulateCursorMove(awareness, clientId!, { row: 1, col: 1, direction: 'across' });
      });

      // Add another collaborator (should trigger notification)
      act(() => {
        simulateCollaboratorJoin(awareness, { name: 'Bob' });
      });

      expect(notify).toHaveBeenCalledWith('Bob joined', expect.any(Object));
    });
  });

  // ============================================================================
  // Collaboration Scenarios
  // ============================================================================

  describe('Collaboration Scenarios', () => {
    describe('setupCollaborationScenario', () => {
      it('should create scenario with local user and collaborators', () => {
        const awareness = setupCollaborationScenario({
          localUser: { name: 'Me', color: '#4F46E5' },
          localCursor: { row: 0, col: 0, direction: 'across' },
          collaborators: [
            { name: 'Alice', cursor: { row: 5, col: 5, direction: 'across' } },
            { name: 'Bob', cursor: { row: 10, col: 10, direction: 'down' } },
          ],
        });

        // Check local state
        const localState = awareness.getStates().get(awareness.clientID);
        expect(localState?.user.name).toBe('Me');

        // Check collaborators
        expect(getCollaboratorCount(awareness)).toBe(2);
      });
    });

    describe('Overlapping Cursors', () => {
      it('should set up multiple cursors at same position', () => {
        const awareness = setupOverlappingCursors({ row: 5, col: 3 }, 3);

        expect(getCollaboratorCount(awareness)).toBe(3);

        const atPosition = getCollaboratorsAtPosition(awareness, { row: 5, col: 3 });
        expect(atPosition).toHaveLength(3);
      });

      it('should detect overlapping cursors', () => {
        const awareness = setupOverlappingCursors({ row: 5, col: 3 }, 2);

        expect(hasCollaboratorAtPosition(awareness, { row: 5, col: 3 })).toBe(true);
        expect(hasCollaboratorAtPosition(awareness, { row: 0, col: 0 })).toBe(false);
      });
    });

    describe('Follow Mode Scenario', () => {
      it('should set up leader and followers', () => {
        const { awareness, leaderId, followerIds } = setupFollowScenario({
          leader: {
            name: 'Leader',
            cursor: { row: 0, col: 0, direction: 'across' },
          },
          followerCount: 2,
        });

        expect(getCollaboratorCount(awareness)).toBe(3);
        expect(followerIds).toHaveLength(2);

        // Check followers are following the leader
        for (const followerId of followerIds) {
          const state = awareness.getCollaboratorState(followerId);
          expect(state?.followingClientId).toBe(leaderId);
        }
      });
    });
  });

  // ============================================================================
  // Simulation Helpers
  // ============================================================================

  describe('Simulation Helpers', () => {
    let awareness: MockAwareness;

    beforeEach(() => {
      awareness = new MockAwareness();
    });

    describe('simulateTyping', () => {
      it('should advance cursor in across direction', () => {
        const clientId = simulateCollaboratorJoin(awareness, {
          cursor: { row: 5, col: 3, direction: 'across' },
        });

        simulateTyping(awareness, clientId);

        const cursor = getCollaboratorCursor(awareness, clientId);
        expect(cursor?.row).toBe(5);
        expect(cursor?.col).toBe(4); // Advanced by 1
      });

      it('should advance cursor in down direction', () => {
        const clientId = simulateCollaboratorJoin(awareness, {
          cursor: { row: 5, col: 3, direction: 'down' },
        });

        simulateTyping(awareness, clientId);

        const cursor = getCollaboratorCursor(awareness, clientId);
        expect(cursor?.row).toBe(6); // Advanced by 1
        expect(cursor?.col).toBe(3);
      });
    });

    describe('createMockCollaborator', () => {
      it('should create collaborator with auto-generated values', () => {
        const collab = createMockCollaborator();

        expect(collab.clientId).toBeGreaterThan(0);
        expect(collab.user.name).toBeTruthy();
        expect(collab.user.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });

      it('should allow overriding values', () => {
        const collab = createMockCollaborator({
          clientId: 999,
          name: 'Custom Name',
          color: '#abcdef',
        });

        expect(collab.clientId).toBe(999);
        expect(collab.user.name).toBe('Custom Name');
        expect(collab.user.color).toBe('#abcdef');
      });
    });

    describe('createMockCollaborators', () => {
      it('should create multiple collaborators', () => {
        const collaborators = createMockCollaborators(5);

        expect(collaborators).toHaveLength(5);

        // Each should have unique clientId
        const ids = collaborators.map(c => c.clientId);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(5);
      });

      it('should apply base options to all', () => {
        const collaborators = createMockCollaborators(3, {
          cursor: { row: 0, col: 0, direction: 'across' },
        });

        for (const collab of collaborators) {
          expect(collab.cursor).not.toBeNull();
          expect(collab.cursor?.row).toBe(0);
        }
      });
    });
  });

  // ============================================================================
  // State Verification
  // ============================================================================

  describe('State Verification Helpers', () => {
    let awareness: MockAwareness;

    beforeEach(() => {
      awareness = new MockAwareness();
    });

    it('getCollaboratorCount should return correct count', () => {
      expect(getCollaboratorCount(awareness)).toBe(0);

      simulateCollaboratorJoin(awareness, {});
      expect(getCollaboratorCount(awareness)).toBe(1);

      simulateCollaboratorJoin(awareness, {});
      expect(getCollaboratorCount(awareness)).toBe(2);
    });

    it('hasCollaborator should detect collaborator presence', () => {
      const clientId = simulateCollaboratorJoin(awareness, {});

      expect(hasCollaborator(awareness, clientId)).toBe(true);
      expect(hasCollaborator(awareness, 9999)).toBe(false);
    });

    it('getCollaboratorCursor should return cursor', () => {
      const clientId = simulateCollaboratorJoin(awareness, {
        cursor: { row: 5, col: 3, direction: 'across' },
      });

      const cursor = getCollaboratorCursor(awareness, clientId);
      expect(cursor?.row).toBe(5);
      expect(cursor?.col).toBe(3);
    });
  });
});
