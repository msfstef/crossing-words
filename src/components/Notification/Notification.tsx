/**
 * Adaptive notification display component.
 *
 * Renders differently based on viewport size:
 * - Compact: Minimal pill indicator at top-center, very discrete
 * - Normal: Slightly more prominent but still unobtrusive at top-right
 *
 * Positioned to never overlap with keyboard, grid, or clue bar.
 */

import { useEffect, useState } from 'react';
import { useNotification } from './NotificationContext';
import './Notification.css';

export function Notification() {
  const { notification, isCompact, dismiss } = useNotification();
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Handle enter/exit animations
  useEffect(() => {
    if (notification) {
      setIsExiting(false);
      // Small delay for enter animation
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      if (isVisible) {
        setIsExiting(true);
        const timer = setTimeout(() => {
          setIsVisible(false);
          setIsExiting(false);
        }, 150); // Match CSS exit animation duration
        return () => clearTimeout(timer);
      }
    }
  }, [notification, isVisible]);

  if (!notification && !isVisible) {
    return null;
  }

  const content = notification ?? { message: '', icon: undefined };

  return (
    <div
      className={`notification ${isCompact ? 'notification--compact' : 'notification--normal'} ${
        isExiting ? 'notification--exiting' : ''
      }`}
      role="status"
      aria-live="polite"
      onClick={dismiss}
    >
      {content.icon && <span className="notification__icon">{content.icon}</span>}
      <span className="notification__message">{content.message}</span>
    </div>
  );
}
