import './ProgressCircle.css';

interface ProgressCircleProps {
  percentage: number;
  isComplete: boolean;
  size?: number;
}

/**
 * Circular progress indicator using SVG.
 * Shows percentage as filled arc, checkmark when complete.
 */
export function ProgressCircle({
  percentage,
  isComplete,
  size = 32,
}: ProgressCircleProps) {
  // SVG circle calculations
  // viewBox is 36x36, circle radius is 16, center at 18,18
  const radius = 16;
  const circumference = 2 * Math.PI * radius; // ~100.53
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  if (isComplete) {
    return (
      <svg
        className="progress-circle progress-circle--complete"
        width={size}
        height={size}
        viewBox="0 0 36 36"
        aria-label="Complete"
      >
        {/* Filled circle */}
        <circle
          className="progress-circle__complete-bg"
          cx="18"
          cy="18"
          r="16"
        />
        {/* Checkmark */}
        <path
          className="progress-circle__checkmark"
          d="M12 18l4 4 8-8"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      className="progress-circle"
      width={size}
      height={size}
      viewBox="0 0 36 36"
      aria-label={`${percentage}% complete`}
    >
      {/* Background track */}
      <circle
        className="progress-circle__track"
        cx="18"
        cy="18"
        r="16"
        fill="none"
        strokeWidth="3"
      />
      {/* Progress arc */}
      <circle
        className="progress-circle__progress"
        cx="18"
        cy="18"
        r="16"
        fill="none"
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
      />
    </svg>
  );
}
