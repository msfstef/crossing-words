/**
 * ProfileDialog component for editing user profile.
 *
 * Modal dialog with avatar upload/camera capture and nickname editing.
 * Follows the ShareDialog pattern for consistent UX.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useProfile } from '../hooks/useProfile';
import {
  processAvatarImage,
  captureVideoFrame,
  isCameraAvailable,
  startCameraStream,
  stopCameraStream,
} from '../lib/imageUtils';
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
  const videoRef = useRef<HTMLVideoElement>(null);

  const {
    profile,
    setNickname,
    setAvatar,
    removeAvatar,
    randomizeNickname,
    maxNicknameLength,
  } = useProfile();

  const [localNickname, setLocalNickname] = useState(profile.nickname);
  const [isCameraMode, setCameraMode] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  // Sync local nickname with profile when dialog opens
  useEffect(() => {
    if (isOpen) {
      setLocalNickname(profile.nickname);
      setError(null);
    }
  }, [isOpen, profile.nickname]);

  // Open/close the dialog element with animation
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      setIsClosing(false);
      dialog.showModal();
    } else if (dialog.open) {
      // Start closing animation
      setIsClosing(true);
      // Cleanup camera when closing
      if (cameraStream) {
        stopCameraStream(cameraStream);
        setCameraStream(null);
        setCameraMode(false);
      }
      const timer = setTimeout(() => {
        dialog.close();
        setIsClosing(false);
      }, CLOSE_ANIMATION_DURATION);
      return () => clearTimeout(timer);
    }
  }, [isOpen, cameraStream]);

  // Handle Escape key and click outside
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    const handleClick = (e: MouseEvent) => {
      const rect = dialog.getBoundingClientRect();
      const isInDialog =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (!isInDialog) {
        onClose();
      }
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('click', handleClick);

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('click', handleClick);
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

  // Handle file selection
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsProcessing(true);
      setError(null);

      try {
        const dataUrl = await processAvatarImage(file);
        await setAvatar(dataUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process image');
      } finally {
        setIsProcessing(false);
        // Reset input so same file can be selected again
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [setAvatar]
  );

  // Start camera preview
  const handleStartCamera = useCallback(async () => {
    setError(null);

    try {
      const stream = await startCameraStream();
      setCameraStream(stream);
      setCameraMode(true);

      // Connect stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      setError('Could not access camera');
      console.error('[ProfileDialog] Camera error:', err);
    }
  }, []);

  // Capture photo from camera
  const handleCapturePhoto = useCallback(async () => {
    if (!videoRef.current) return;

    setIsProcessing(true);
    setError(null);

    try {
      const dataUrl = captureVideoFrame(videoRef.current);
      await setAvatar(dataUrl);

      // Stop camera after capture
      if (cameraStream) {
        stopCameraStream(cameraStream);
        setCameraStream(null);
      }
      setCameraMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture photo');
    } finally {
      setIsProcessing(false);
    }
  }, [cameraStream, setAvatar]);

  // Cancel camera mode
  const handleCancelCamera = useCallback(() => {
    if (cameraStream) {
      stopCameraStream(cameraStream);
      setCameraStream(null);
    }
    setCameraMode(false);
  }, [cameraStream]);

  // Handle remove avatar
  const handleRemoveAvatar = useCallback(async () => {
    setIsProcessing(true);
    try {
      await removeAvatar();
    } finally {
      setIsProcessing(false);
    }
  }, [removeAvatar]);

  // Handle randomize nickname
  const handleRandomize = useCallback(() => {
    randomizeNickname();
    setLocalNickname(profile.nickname);
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

  // Keep dialog mounted during close animation
  if (!isOpen && !isClosing) {
    return null;
  }

  const canUseCamera = isCameraAvailable();

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

        {/* Avatar Section */}
        <div className="profile-dialog__avatar-section">
          {isCameraMode ? (
            <div className="profile-dialog__camera-preview">
              <video
                ref={videoRef}
                className="profile-dialog__video"
                autoPlay
                playsInline
                muted
              />
              <div className="profile-dialog__camera-overlay" />
            </div>
          ) : (
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
          )}
        </div>

        {/* Avatar Actions */}
        <div className="profile-dialog__avatar-actions">
          {isCameraMode ? (
            <>
              <button
                type="button"
                className="profile-dialog__button profile-dialog__button--primary"
                onClick={handleCapturePhoto}
                disabled={isProcessing}
              >
                {isProcessing ? 'Saving...' : 'Take Photo'}
              </button>
              <button
                type="button"
                className="profile-dialog__button"
                onClick={handleCancelCamera}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="profile-dialog__button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Upload Photo'}
              </button>
              {canUseCamera && (
                <button
                  type="button"
                  className="profile-dialog__button"
                  onClick={handleStartCamera}
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
            </>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
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
              onChange={(e) => setLocalNickname(e.target.value)}
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
          <div className="profile-dialog__char-count">
            {localNickname.length}/{maxNicknameLength}
          </div>
        </div>
      </div>
    </dialog>
  );
}
