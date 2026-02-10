import React from 'react';
import { usePuzzle } from '../../context/PuzzleContext';
import { getClueKeyForCell } from '../../utils/gridUtils';

const CurrentClue: React.FC = () => {
  const { state } = usePuzzle();

  if (!state.selection || !state.grid || !state.clueMap) {
    return null;
  }

  const { row, col, direction } = state.selection;

  // Get the clue for the current selection
  const clueKey = getClueKeyForCell(state.grid, row, col, direction, state.clueMap);

  if (!clueKey) {
    return null;
  }

  const clueInfo = state.clueMap.get(clueKey);

  if (!clueInfo) {
    return null;
  }

  // Remove leading number and period from clue text if present
  const clueText = clueInfo.clue.replace(/^\d+\.\s*/, '');

  return (
    <div className="current-clue">
      <span className="current-clue-label">
        {clueInfo.number}. {direction === 'across' ? 'Across' : 'Down'}
      </span>
      <span className="current-clue-text">{clueText}</span>
    </div>
  );
};

export default CurrentClue;
