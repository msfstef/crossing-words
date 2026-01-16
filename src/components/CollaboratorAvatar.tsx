import { useState, useEffect, useRef } from 'react';
import type { UserInfo } from '../collaboration/types';
import './CollaboratorAvatar.css';

interface CollaboratorAvatarProps {
  user: UserInfo;
  /** Unique key for animation tracking */
  avatarKey: string;
  /** Whether this is the local user */
  isSelf?: boolean;
  /** Size variant */
  size?: 'small' | 'medium';
  /** Optional className for container */
  className?: string;
  /** Whether to use overlapping style (negative margin) */
  overlapping?: boolean;
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
 * Hook to preload an image and track its loading state.
 * Returns whether the image is loaded and whether the avatar should be visible.
 */
function useImagePreload(src: string | undefined): { isLoaded: boolean; isVisible: boolean } {
  // Track loaded URLs - starts empty, gets populated when images load
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(() => new Set());
  // Track URLs that failed to load
  const [errorUrls, setErrorUrls] = useState<Set<string>>(() => new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!src) {
      return;
    }

    // Already loaded or errored
    if (loadedUrls.has(src) || errorUrls.has(src)) {
      return;
    }

    const img = new Image();
    img.onload = () => {
      if (mountedRef.current) {
        setLoadedUrls((prev) => new Set(prev).add(src));
      }
    };
    img.onerror = () => {
      if (mountedRef.current) {
        setErrorUrls((prev) => new Set(prev).add(src));
      }
    };
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, loadedUrls, errorUrls]);

  // Derive state from props and loaded URLs
  const isLoaded = !!src && loadedUrls.has(src);
  const hasError = !!src && errorUrls.has(src);
  // Avatar is visible when: no avatar, loaded successfully, or errored (show initials)
  const isVisible = !src || isLoaded || hasError;

  return { isLoaded, isVisible };
}

/**
 * Single collaborator avatar with:
 * - Initials fallback when no avatar
 * - Image preloading to avoid flash
 * - Smooth appear animation
 */
export function CollaboratorAvatar({
  user,
  avatarKey,
  isSelf = false,
  size = 'small',
  className = '',
  overlapping = false,
}: CollaboratorAvatarProps) {
  const { isLoaded, isVisible } = useImagePreload(user.avatar);

  const initials = getInitials(user.name);
  const title = isSelf ? `${user.name} (you)` : user.name;
  const showImage = isLoaded && user.avatar;

  const classes = [
    'collaborator-avatar',
    `collaborator-avatar--${size}`,
    overlapping && 'collaborator-avatar--overlapping',
    isSelf && 'collaborator-avatar--self',
    isVisible && 'collaborator-avatar--visible',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      key={avatarKey}
      className={classes}
      style={{
        borderColor: user.color,
        backgroundColor: showImage ? 'transparent' : user.color,
      }}
      title={title}
    >
      {showImage ? (
        <img
          src={user.avatar}
          alt=""
          className="collaborator-avatar__image"
        />
      ) : (
        <span className="collaborator-avatar__initials">
          {initials}
        </span>
      )}
    </div>
  );
}

interface OverflowAvatarProps {
  count: number;
  size?: 'small' | 'medium';
  overlapping?: boolean;
}

/**
 * Overflow indicator showing "+N" for additional collaborators.
 */
export function OverflowAvatar({
  count,
  size = 'small',
  overlapping = false,
}: OverflowAvatarProps) {
  const classes = [
    'collaborator-avatar',
    'collaborator-avatar--overflow',
    `collaborator-avatar--${size}`,
    overlapping && 'collaborator-avatar--overlapping',
    'collaborator-avatar--visible',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <span className="collaborator-avatar__initials">
        +{count}
      </span>
    </div>
  );
}
