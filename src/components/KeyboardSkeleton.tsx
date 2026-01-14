import './KeyboardSkeleton.css';

/**
 * Skeleton/ghost component for CrosswordKeyboard during loading.
 * Matches the 3-row QWERTY layout structure with exact dimensions.
 */
export function KeyboardSkeleton() {
  return (
    <div className="keyboard-skeleton" aria-hidden="true">
      <div className="keyboard-skeleton__container">
        {/* Row 1: 10 keys (Q W E R T Y U I O P) */}
        <div className="keyboard-skeleton__row">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="keyboard-skeleton__key" />
          ))}
        </div>
        {/* Row 2: 9 keys (A S D F G H J K L) */}
        <div className="keyboard-skeleton__row">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="keyboard-skeleton__key" />
          ))}
        </div>
        {/* Row 3: 7 keys + backspace (Z X C V B N M + bksp) */}
        <div className="keyboard-skeleton__row">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="keyboard-skeleton__key" />
          ))}
          <div className="keyboard-skeleton__key keyboard-skeleton__key--wide" />
        </div>
      </div>
    </div>
  );
}
