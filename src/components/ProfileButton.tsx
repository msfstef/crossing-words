/**
 * ProfileButton component for the library header.
 *
 * Displays either a user icon (when no avatar) or the user's avatar.
 * Opens ProfileDialog on click.
 */

import { useState } from 'react';
import { useProfile } from '../hooks/useProfile';
import { ProfileDialog } from './ProfileDialog';
import './ProfileButton.css';

/**
 * Profile button for the library header.
 * Shows avatar if available, otherwise a user icon.
 */
export function ProfileButton() {
  const [isDialogOpen, setDialogOpen] = useState(false);
  const { profile } = useProfile();

  return (
    <>
      <button
        type="button"
        className="profile-button"
        onClick={() => setDialogOpen(true)}
        aria-label="Profile settings"
        title="Profile settings"
      >
        {profile.avatar ? (
          <img
            src={profile.avatar}
            alt=""
            className="profile-button__avatar"
          />
        ) : (
          <svg
            className="profile-button__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
          </svg>
        )}
      </button>

      <ProfileDialog
        isOpen={isDialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
