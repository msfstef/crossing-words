import type { ReactNode } from 'react';
import './SolveLayout.css';

interface SolveLayoutProps {
  header: ReactNode;
  grid: ReactNode;
  clueBar: ReactNode;
  keyboard?: ReactNode | null;
}

/**
 * Responsive layout shell for the puzzle solving view.
 * Uses CSS Grid with areas: header, grid, clue-bar, keyboard.
 * Grid area uses flex-grow to maximize space.
 */
export function SolveLayout({ header, grid, clueBar, keyboard }: SolveLayoutProps) {
  return (
    <div className="solve-layout">
      <div className="solve-layout__header">{header}</div>
      <div className="solve-layout__grid">{grid}</div>
      <div className="solve-layout__clue-bar">{clueBar}</div>
      {keyboard && <div className="solve-layout__keyboard">{keyboard}</div>}
    </div>
  );
}
