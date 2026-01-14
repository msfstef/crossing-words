/**
 * Hook for following a collaborator's cursor movements.
 *
 * Allows the local user to "follow" another collaborator, automatically
 * syncing their cursor position to the followed collaborator's cursor.
 * Automatically disables when the followed collaborator leaves or when
 * the local user makes any movement.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { Awareness } from 'y-protocols/awareness';
import type { Collaborator } from './types';

interface FollowCollaboratorHook {
  /** The collaborator currently being followed, or null if not following */
  followedCollaborator: Collaborator | null;
  /** Toggle follow mode - cycles through collaborators or disables */
  toggleFollow: () => void;
  /** Whether currently following someone */
  isFollowing: boolean;
  /** Manually disable follow mode */
  disableFollow: () => void;
}

/**
 * Hook for following a collaborator's cursor.
 *
 * @param collaborators - Array of current collaborators
 * @param awareness - Yjs Awareness instance
 * @param onCursorUpdate - Callback to update local cursor position
 * @returns Follow state and controls
 *
 * @example
 * ```typescript
 * const { followedCollaborator, toggleFollow, isFollowing } = useFollowCollaborator(
 *   collaborators,
 *   awareness,
 *   (row, col, direction) => {
 *     setSelectedCell({ row, col });
 *     setDirection(direction);
 *   }
 * );
 * ```
 */
export function useFollowCollaborator(
  collaborators: Collaborator[],
  awareness: Awareness | null,
  onCursorUpdate: (row: number, col: number, direction: 'across' | 'down') => void
): FollowCollaboratorHook {
  const [followedClientId, setFollowedClientId] = useState<number | null>(null);
  const previousFollowedIdRef = useRef<number | null>(null);

  // Get the currently followed collaborator
  const followedCollaborator = collaborators.find((c) => c.clientId === followedClientId) ?? null;

  /**
   * Disable follow mode.
   */
  const disableFollow = useCallback(() => {
    if (followedClientId !== null) {
      setFollowedClientId(null);

      // Clear the following state in awareness
      if (awareness) {
        awareness.setLocalStateField('followingClientId', null);
      }
    }
  }, [followedClientId, awareness]);

  /**
   * Toggle follow mode - cycle through collaborators or disable.
   */
  const toggleFollow = useCallback(() => {
    if (collaborators.length === 0) {
      disableFollow();
      return;
    }

    if (followedClientId === null) {
      // Not following anyone - start following the first collaborator
      const firstCollab = collaborators[0];
      setFollowedClientId(firstCollab.clientId);

      // Notify the followed collaborator via awareness
      if (awareness) {
        awareness.setLocalStateField('followingClientId', firstCollab.clientId);
      }

      toast(`Following ${firstCollab.user.name}`, { duration: 2000 });
    } else {
      // Already following someone - find the next collaborator
      const currentIndex = collaborators.findIndex((c) => c.clientId === followedClientId);

      if (currentIndex === -1) {
        // Current followed collaborator is gone - disable follow
        disableFollow();
        return;
      }

      if (currentIndex === collaborators.length - 1) {
        // Last collaborator - disable follow
        disableFollow();
        toast('Stopped following', { duration: 2000 });
      } else {
        // Move to next collaborator
        const nextCollab = collaborators[currentIndex + 1];
        setFollowedClientId(nextCollab.clientId);

        // Update awareness
        if (awareness) {
          awareness.setLocalStateField('followingClientId', nextCollab.clientId);
        }

        toast(`Following ${nextCollab.user.name}`, { duration: 2000 });
      }
    }
  }, [collaborators, followedClientId, awareness, disableFollow]);

  /**
   * Auto-disable follow when the followed collaborator leaves.
   */
  useEffect(() => {
    if (followedClientId === null) return;

    // Check if the followed collaborator still exists
    const stillExists = collaborators.some((c) => c.clientId === followedClientId);

    if (!stillExists) {
      toast('Collaborator left - stopped following', { duration: 2000 });
      disableFollow();
    }
  }, [collaborators, followedClientId, disableFollow]);

  /**
   * Sync local cursor to followed collaborator's cursor.
   */
  useEffect(() => {
    if (!followedCollaborator?.cursor) return;

    const { row, col, direction } = followedCollaborator.cursor;
    onCursorUpdate(row, col, direction);
  }, [followedCollaborator, onCursorUpdate]);

  /**
   * Send notification to the followed collaborator when we start following them.
   */
  useEffect(() => {
    if (!awareness) return;

    // Detect when someone starts or stops following us
    const handleChange = () => {
      const states = awareness.getStates();
      const localClientId = awareness.clientID;

      // Check if anyone is now following us
      states.forEach((state: any, clientId: number) => {
        if (clientId === localClientId) return;

        const followingId = state.followingClientId;
        if (followingId === localClientId) {
          const followerName = state.user?.name;
          if (followerName) {
            toast(`${followerName} is following you`, { icon: '👁️', duration: 3000 });
          }
        }
      });
    };

    awareness.on('change', handleChange);
    return () => awareness.off('change', handleChange);
  }, [awareness]);

  /**
   * Notify the followed collaborator that we started following them.
   * Only triggers when followedClientId changes (not on every render).
   */
  useEffect(() => {
    // Only notify when we transition from not following to following someone new
    if (followedClientId !== null && followedClientId !== previousFollowedIdRef.current) {
      // This is handled by awareness change listener above
    }
    previousFollowedIdRef.current = followedClientId;
  }, [followedClientId]);

  return {
    followedCollaborator,
    toggleFollow,
    isFollowing: followedClientId !== null,
    disableFollow,
  };
}
