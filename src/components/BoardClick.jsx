import React from 'react';
import Board from './Board';

// Thin wrapper to explicitly use click gameplay (reuse existing Board implementation)
export default function BoardClick(props) {
  return <Board {...props} gameplayVariant="click" />;
}
