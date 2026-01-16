import Keyboard from 'react-simple-keyboard';
import 'react-simple-keyboard/build/css/index.css';
import { useSwipeNavigation, type SwipeDirection } from '../../hooks/useSwipeNavigation';
import './CrosswordKeyboard.css';

interface CrosswordKeyboardProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  /** Callback for swipe navigation (mobile only) */
  onSwipe?: (direction: SwipeDirection) => void;
  /** Whether the device supports touch */
  isTouchDevice?: boolean;
}

/**
 * Custom virtual keyboard for crossword input.
 * QWERTY layout with letters only (no numbers) and backspace.
 * Themed to match app design using CSS variables.
 */
export function CrosswordKeyboard({
  onKeyPress,
  onBackspace,
  onSwipe,
  isTouchDevice = false,
}: CrosswordKeyboardProps) {
  // Swipe navigation handlers (only active on touch devices)
  const swipeHandlers = useSwipeNavigation({
    onSwipe: onSwipe ?? (() => {}),
    enabled: isTouchDevice && Boolean(onSwipe),
  });

  // QWERTY layout with backspace on bottom row
  const layout = {
    default: [
      'Q W E R T Y U I O P',
      'A S D F G H J K L',
      'Z X C V B N M {bksp}',
    ],
  };

  // Display labels for special keys
  const display = {
    '{bksp}': '⌫',
  };

  const handleKeyPress = (button: string) => {
    if (button === '{bksp}') {
      onBackspace();
    } else {
      // Letter keys - pass uppercase letter
      onKeyPress(button.toUpperCase());
    }
  };

  return (
    <div className="crossword-keyboard" {...swipeHandlers}>
      <Keyboard
        layout={layout}
        display={display}
        onKeyPress={handleKeyPress}
        theme="hg-theme-default crossword-keyboard-theme"
        mergeDisplay={true}
        disableCaretPositioning={true}
      />
    </div>
  );
}
