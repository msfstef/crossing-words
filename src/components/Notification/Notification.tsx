/**
 * Adaptive notification display component.
 *
 * Renders differently based on viewport size:
 * - Compact: Minimal pill indicator at top-center, very discrete
 * - Normal: Slightly more prominent but still unobtrusive at top-right
 *
 * Positioned to never overlap with keyboard, grid, or clue bar.
 *
 * Uses a key-based approach for smooth animations - each unique notification
 * gets a fresh DOM element, ensuring CSS animations play reliably.
 */

import { useEffect, useState, useRef } from 'react';
import { useNotification, type NotificationItem } from './NotificationContext';
import './Notification.css';

export function Notification() {
  const { notification, isCompact, dismiss } = useNotification();

  // Track the currently displayed notification for exit animation
  // This preserves the content while the exit animation plays
  const [displayedNotification, setDisplayedNotification] = useState<NotificationItem | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // Clear any pending exit timer
    if (exitTimerRef.current !== null) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }

    if (notification) {
      // New notification arrived - show it immediately
      setIsExiting(false);
      setDisplayedNotification(notification);
    } else if (displayedNotification && !isExiting) {
      // Notification cleared - start exit animation
      setIsExiting(true);
      exitTimerRef.current = window.setTimeout(() => {
        setDisplayedNotification(null);
        setIsExiting(false);
        exitTimerRef.current = null;
      }, 150); // Match CSS exit animation duration
    }
  }, [notification, displayedNotification, isExiting]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  if (!displayedNotification) {
    return null;
  }

  return (
    <div
      // Key by notification id to ensure fresh DOM element for each notification
      // This guarantees the enter animation plays for every new notification
      key={displayedNotification.id}
      className={`notification ${isCompact ? 'notification--compact' : 'notification--normal'} ${
        isExiting ? 'notification--exiting' : ''
      }`}
      role="status"
      aria-live="polite"
      onClick={dismiss}
    >
      {displayedNotification.icon && (
        <span className="notification__icon">{displayedNotification.icon}</span>
      )}
      <span className="notification__message">{displayedNotification.message}</span>
    </div>
  );
}
