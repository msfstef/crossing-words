import type { Collaborator } from '../collaboration/types';
import { CollaboratorAvatar, OverflowAvatar } from './CollaboratorAvatar';
import './CollaboratorAvatars.css';

interface CollaboratorAvatarsProps {
  collaborators: Collaborator[];
}

/**
 * Display a row of small circular avatars for connected collaborators.
 * Shows colored circles with initials, tooltip on hover for full name.
 * Limits display to 8 avatars with "+N" indicator for overflow.
 */
export function CollaboratorAvatars({ collaborators }: CollaboratorAvatarsProps) {
  // Don't render anything if no collaborators
  if (collaborators.length === 0) {
    return null;
  }

  const maxDisplay = 8;
  const displayedCollaborators = collaborators.slice(0, maxDisplay);
  const overflowCount = collaborators.length - maxDisplay;

  return (
    <div className="collaborator-avatars">
      {displayedCollaborators.map((collaborator) => (
        <CollaboratorAvatar
          key={collaborator.clientId}
          avatarKey={String(collaborator.clientId)}
          user={collaborator.user}
          size="small"
        />
      ))}
      {overflowCount > 0 && (
        <OverflowAvatar count={overflowCount} size="small" />
      )}
    </div>
  );
}
