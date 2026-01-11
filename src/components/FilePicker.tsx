import { useRef } from 'react';
import type { Puzzle } from '../types/puzzle';
import { importPuzzle } from '../lib/puzzleImport';
import './FilePicker.css';

interface FilePickerProps {
  onPuzzleLoaded: (puzzle: Puzzle) => void;
  onError: (error: string) => void;
}

export function FilePicker({ onPuzzleLoaded, onError }: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const puzzle = await importPuzzle(file);
      onPuzzleLoaded(puzzle);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load puzzle';
      onError(message);
    }

    // Clear input value so the same file can be re-selected
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="file-picker">
      <input
        type="file"
        accept=".puz,.ipuz,.jpz"
        ref={inputRef}
        onChange={handleFileChange}
        className="file-picker__input"
      />
      <button
        type="button"
        onClick={handleButtonClick}
        className="file-picker__button"
      >
        Open Puzzle
      </button>
    </div>
  );
}
