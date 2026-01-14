import type { Collaborator } from '../collaboration/types';
import './CollaboratorAvatars.css';

interface CollaboratorAvatarsProps {
  collaborators: Collaborator[];
}

/**
 * Get initials from a name (first 1-2 characters).
 */
function getInitials(name: string): string {
  const words = name.split(' ').filter(Boolean);
  if (words.length >= 2) {
    // Two words: first letter of each
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  // Single word: first two letters
  return name.slice(0, 2).toUpperCase();
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
        <div
          key={collaborator.clientId}
          className="collaborator-avatar"
          style={{ borderColor: collaborator.user.color }}
          title={collaborator.user.name}
        >
          {collaborator.user.avatar ? (
            <img
              src={collaborator.user.avatar}
              alt=""
              className="collaborator-avatar__image"
            />
          ) : (
            <span
              className="collaborator-avatar__initials"
              style={{ backgroundColor: collaborator.user.color }}
            >
              {getInitials(collaborator.user.name)}
            </span>
          )}
        </div>
      ))}
      {overflowCount > 0 && (
        <div className="collaborator-avatar collaborator-avatar--overflow">
          <span className="collaborator-avatar__initials">+{overflowCount}</span>
        </div>
      )}
    </div>
  );
}
