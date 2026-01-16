/**
 * ProfileDialog component for editing user profile.
 *
 * Modal dialog with avatar upload/camera capture and nickname editing.
 * Uses HTML capture attribute for unified camera/file picker experience:
 * - On mobile: Opens camera directly (front-facing by default)
 * - On desktop: Opens file picker
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useProfile } from '../hooks/useProfile';
import { useDialogHistory } from '../hooks/useDialogHistory';
import { processAvatarImages } from '../lib/imageUtils';
import './ProfileDialog.css';

/** Duration of the close animation in ms */
const CLOSE_ANIMATION_DURATION = 120;

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Profile editing dialog.
 */
export function ProfileDialog({ isOpen, onClose }: ProfileDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const {
    profile,
    setNickname,
    setAvatar,
    removeAvatar,
    randomizeNickname,
    maxNicknameLength,
  } = useProfile();

  const [localNickname, setLocalNickname] = useState(profile.nickname);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMaxLengthHint, setShowMaxLengthHint] = useState(false);
  // Track visibility separately from isOpen prop to allow close animation
  const [isVisible, setIsVisible] = useState(isOpen);

  // Track if file picker is open to prevent click-outside from closing dialog
  const isFilePickerOpen = useRef(false);

  // Handle back button navigation
  useDialogHistory(isOpen, onClose, 'profile');

  // Sync local nickname with profile when dialog opens
  useEffect(() => {
    if (isOpen) {
      setLocalNickname(profile.nickname);
      setError(null);
      setShowMaxLengthHint(false);
    }
  }, [isOpen, profile.nickname]);

  // Handle visibility transitions with animation
  useEffect(() => {
    if (isOpen) {
      // Opening: show immediately
      setIsVisible(true);
    } else if (isVisible) {
      // Closing: wait for animation before hiding
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, CLOSE_ANIMATION_DURATION);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isVisible]);

  // Open/close the native dialog element
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isVisible && isOpen) {
      dialog.showModal();
    } else if (!isVisible) {
      dialog.close();
    }
  }, [isVisible, isOpen]);

  // Handle Escape key and click outside
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    // Check if event coordinates are outside the dialog bounds
    const isClickOutside = (clientX: number, clientY: number): boolean => {
      const rect = dialog.getBoundingClientRect();
      return (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      );
    };

    const handleClick = (e: MouseEvent) => {
      // Don't close if file picker was just opened
      // (click events can fire after file picker closes)
      if (isFilePickerOpen.current) {
        return;
      }

      // Close if clicking on the backdrop (outside the dialog content)
      if (isClickOutside(e.clientX, e.clientY)) {
        onClose();
      }
    };

    // Handle touch events for mobile - use touchend for consistency
    const handleTouchEnd = (e: TouchEvent) => {
      // Don't close if file picker was just opened
      if (isFilePickerOpen.current) {
        return;
      }
      // Only handle single touch
      if (e.changedTouches.length !== 1) return;
      const touch = e.changedTouches[0];
      if (isClickOutside(touch.clientX, touch.clientY)) {
        // Prevent the subsequent click event from also firing
        e.preventDefault();
        onClose();
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleClick);
    dialog.addEventListener('touchend', handleTouchEnd);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleClick);
      dialog.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onClose]);

  // Save nickname when it changes (debounced)
  useEffect(() => {
    const trimmed = localNickname.trim();
    if (trimmed && trimmed !== profile.nickname) {
      const timer = setTimeout(() => {
        setNickname(trimmed);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [localNickname, profile.nickname, setNickname]);

  // Handle file/camera selection
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      // Reset file picker flag
      isFilePickerOpen.current = false;

      const file = e.target.files?.[0];
      if (!file) return;

      setIsProcessing(true);
      setError(null);

      try {
        const images = await processAvatarImages(file);
        await setAvatar(images);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process image');
      } finally {
        setIsProcessing(false);
        // Reset input so same file can be selected again
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        if (cameraInputRef.current) {
          cameraInputRef.current.value = '';
        }
      }
    },
    [setAvatar]
  );

  // Reset file picker flag when window regains focus (file picker closed)
  useEffect(() => {
    const handleFocus = () => {
      // Small delay to let any pending click events fire first
      setTimeout(() => {
        isFilePickerOpen.current = false;
      }, 100);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Open file picker (upload from gallery/files)
  const handleUploadClick = useCallback(() => {
    isFilePickerOpen.current = true;
    fileInputRef.current?.click();
  }, []);

  // Open camera (uses HTML capture attribute)
  const handleCameraClick = useCallback(() => {
    isFilePickerOpen.current = true;
    cameraInputRef.current?.click();
  }, []);

  // Handle remove avatar
  const handleRemoveAvatar = useCallback(async () => {
    setIsProcessing(true);
    try {
      await removeAvatar();
    } finally {
      setIsProcessing(false);
    }
  }, [removeAvatar]);

  // Handle nickname input with max length hint
  const handleNicknameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      // Check if user is trying to type beyond max length
      if (value.length >= maxNicknameLength) {
        setShowMaxLengthHint(true);
        // Hide hint after 2 seconds
        setTimeout(() => setShowMaxLengthHint(false), 2000);
      }

      setLocalNickname(value);
    },
    [maxNicknameLength]
  );

  // Handle randomize nickname
  const handleRandomize = useCallback(() => {
    randomizeNickname();
    setLocalNickname(profile.nickname);
    setShowMaxLengthHint(false);
  }, [randomizeNickname, profile.nickname]);

  // Use effect to update local nickname after randomize
  useEffect(() => {
    if (profile.nickname !== localNickname) {
      // Only update if it was randomized (not a user edit)
      const trimmed = localNickname.trim();
      if (!trimmed || trimmed === localNickname) {
        setLocalNickname(profile.nickname);
      }
    }
  }, [profile.nickname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only render when visible (stays visible during close animation)
  if (!isVisible) {
    return null;
  }

  // isClosing = prop says closed but we're still visible (animating out)
  const isClosing = !isOpen && isVisible;

  // Check if device likely has a camera (mobile or tablet)
  const isMobileDevice =
    typeof window !== 'undefined' &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  return (
    <dialog
      ref={dialogRef}
      className={`profile-dialog${isClosing ? ' profile-dialog--closing' : ''}`}
    >
      <div className="profile-dialog__content">
        <button
          type="button"
          className="profile-dialog__close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          &times;
        </button>

        <h2 className="profile-dialog__heading">Profile</h2>

        {/* Avatar Section - avatar with actions on the side */}
        <div className="profile-dialog__avatar-section">
          <div className="profile-dialog__avatar-preview">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt="Your avatar"
                className="profile-dialog__avatar-image"
              />
            ) : (
              <div className="profile-dialog__avatar-placeholder">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                </svg>
              </div>
            )}
          </div>

          {/* Avatar Actions - stacked vertically next to avatar */}
          <div className="profile-dialog__avatar-actions">
            <button
              type="button"
              className="profile-dialog__button"
              onClick={handleUploadClick}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Upload Photo'}
            </button>
            {isMobileDevice && (
              <button
                type="button"
                className="profile-dialog__button"
                onClick={handleCameraClick}
                disabled={isProcessing}
              >
                Camera
              </button>
            )}
            {profile.avatar && (
              <button
                type="button"
                className="profile-dialog__button profile-dialog__button--danger"
                onClick={handleRemoveAvatar}
                disabled={isProcessing}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Hidden file input for gallery/file upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="profile-dialog__file-input"
        />

        {/* Hidden file input with capture for camera (mobile only) */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleFileSelect}
          className="profile-dialog__file-input"
        />

        {/* Error message */}
        {error && <div className="profile-dialog__error">{error}</div>}

        {/* Nickname Section */}
        <div className="profile-dialog__nickname-section">
          <label className="profile-dialog__label">Nickname</label>
          <div className="profile-dialog__nickname-row">
            <input
              type="text"
              value={localNickname}
              onChange={handleNicknameChange}
              maxLength={maxNicknameLength}
              className="profile-dialog__nickname-input"
              placeholder="Enter nickname"
            />
            <button
              type="button"
              className="profile-dialog__randomize"
              onClick={handleRandomize}
              aria-label="Generate random nickname"
              title="Randomize"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 4v6h6" />
                <path d="M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
            </button>
          </div>
          {showMaxLengthHint && (
            <div className="profile-dialog__max-hint">
              Maximum {maxNicknameLength} characters
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
