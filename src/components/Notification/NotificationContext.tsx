/**
 * Notification system with viewport-aware positioning.
 *
 * On compact viewports (mobile with keyboard), notifications appear as
 * minimal indicators at the top. On larger viewports, they use more
 * traditional toast positioning where space allows.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';

export interface NotificationItem {
  id: string;
  message: string;
  icon?: string;
  duration: number;
  timestamp: number;
}

interface NotificationContextValue {
  /** Current notification to display (only one at a time for minimal UI) */
  notification: NotificationItem | null;
  /** Show a notification */
  notify: (message: string, options?: { icon?: string; duration?: number }) => void;
  /** Dismiss the current notification */
  dismiss: () => void;
  /** Whether viewport is compact (should use discrete mode) */
  isCompact: boolean;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

/**
 * Breakpoint for compact mode.
 * Below this height, notifications use minimal discrete styling.
 * This threshold accounts for mobile viewports with virtual keyboard.
 */
const COMPACT_HEIGHT_THRESHOLD = 500;

/**
 * Breakpoint for width-based compact mode.
 * Below this width, always use compact mode regardless of height.
 */
const COMPACT_WIDTH_THRESHOLD = 400;

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notification, setNotification] = useState<NotificationItem | null>(null);
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === 'undefined') return true;
    return (
      window.innerHeight < COMPACT_HEIGHT_THRESHOLD ||
      window.innerWidth < COMPACT_WIDTH_THRESHOLD
    );
  });

  // Track viewport size to determine compact mode
  useEffect(() => {
    const updateCompact = () => {
      setIsCompact(
        window.innerHeight < COMPACT_HEIGHT_THRESHOLD ||
        window.innerWidth < COMPACT_WIDTH_THRESHOLD
      );
    };

    window.addEventListener('resize', updateCompact);
    // Also listen for orientation change on mobile
    window.addEventListener('orientationchange', updateCompact);

    return () => {
      window.removeEventListener('resize', updateCompact);
      window.removeEventListener('orientationchange', updateCompact);
    };
  }, []);

  // Auto-dismiss timer
  useEffect(() => {
    if (!notification) return;

    const timeRemaining = notification.duration - (Date.now() - notification.timestamp);
    if (timeRemaining <= 0) {
      setNotification(null);
      return;
    }

    const timer = setTimeout(() => {
      setNotification(null);
    }, timeRemaining);

    return () => clearTimeout(timer);
  }, [notification]);

  const notify = useCallback(
    (message: string, options?: { icon?: string; duration?: number }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const duration = options?.duration ?? 2500;

      setNotification({
        id,
        message,
        icon: options?.icon,
        duration,
        timestamp: Date.now(),
      });
    },
    []
  );

  const dismiss = useCallback(() => {
    setNotification(null);
  }, []);

  const value = useMemo(
    () => ({
      notification,
      notify,
      dismiss,
      isCompact,
    }),
    [notification, notify, dismiss, isCompact]
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

/**
 * Hook to access notification functions.
 */
export function useNotification(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
}
