import React, { useState, useEffect, useRef } from 'react';
import './GuessReveal.css';

export default function GuessReveal({ 
  gameState, 
  finalGrid, 
  totalMoves, 
  onNewGame, 
  onSaveToGallery, 
  playerNames,
  history = []  // array of grids for replay
}) {
  const [player1Guess, setPlayer1Guess] = useState('');
  const [player2Guess, setPlayer2Guess] = useState('');
  const [guessesRevealed, setGuessesRevealed] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('GuessReveal received props:', {
      finalGrid,
      totalMoves,
      history,
      historyLength: history?.length,
      playerNames
    });
  }, [finalGrid, totalMoves, history, playerNames]);
  const replayInterval = useRef(null);

  if (gameState !== 'reveal') return null;

  // Auto replay effect
  useEffect(() => {
    if (isReplaying && history.length > 1) {
      replayInterval.current = setInterval(() => {
        setReplayIndex(idx => (idx + 1) % history.length);
      }, 500);
    } else if (replayInterval.current) {
      clearInterval(replayInterval.current);
    }
    return () => clearInterval(replayInterval.current);
  }, [isReplaying, history]);

  // Determine grid to display
  // Convert tile positions to 2D grid
  const convertTilesToGrid = (tiles, gridSize = 10) => {
    if (!tiles || !Array.isArray(tiles)) return [];
    
    // Create empty grid
    const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
    
    // Fill grid with tile positions
    tiles.forEach(tile => {
      if (tile && typeof tile.x === 'number' && typeof tile.y === 'number') {
        if (tile.x >= 0 && tile.x < gridSize && tile.y >= 0 && tile.y < gridSize) {
          grid[tile.y][tile.x] = 1;
        }
      }
    });
    
    return grid;
  };

  // Get display grid with proper fallback
  const getDisplayGrid = () => {
    if ((isReplaying || replayIndex > 0) && history && history.length > 0 && history[replayIndex]) {
      const historyFrame = history[replayIndex];
      // Check if it's already a 2D grid or needs conversion
      if (Array.isArray(historyFrame) && historyFrame.length > 0) {
        if (Array.isArray(historyFrame[0])) {
          // Already a 2D grid
          return historyFrame;
        } else {
          // Convert tile positions to grid
          return convertTilesToGrid(historyFrame);
        }
      }
    }
    return finalGrid || [];
  };
  
  const displayGrid = getDisplayGrid();

  const handleRevealGuesses = () => {
    setGuessesRevealed(true);
  };

  const handleSaveShape = () => {
    const shapeData = {
      grid: finalGrid,
      moves: totalMoves,
      player1Guess,
      player2Guess,
      timestamp: new Date().toISOString(),
      players: playerNames
    };
    onSaveToGallery(shapeData);
  };

  return (
    <div className="guess-reveal">
      {/* Replay Controls */}
      {history.length > 1 && (
        <div className="replay-controls">
          <button onClick={() => setIsReplaying(!isReplaying)}>
            {isReplaying ? 'Pause Replay' : 'Play Replay'}
          </button>
          <input
            type="range"
            min={0}
            max={history.length - 1}
            value={replayIndex}
            onChange={e => { setIsReplaying(false); setReplayIndex(+e.target.value); }}
          />
          <span>Move {replayIndex}</span>
        </div>
      )}

      <h2>Shape Complete!</h2>
      <p>Total moves made: {totalMoves}</p>
      
      {/* Display the final shape or replay frame */}
      <div className="final-shape">
        <h3>Final Shape:</h3>
        <div className="shape-grid">
          {displayGrid && Array.isArray(displayGrid) ? displayGrid.map((row, rowIdx) => (
            <div key={rowIdx} className="shape-row">
              {Array.isArray(row) ? row.map((cell, colIdx) => (
                <div
                  key={`${rowIdx}-${colIdx}`}
                  className={`shape-cell ${cell === 1 ? 'filled' : 'empty'}`}
                />
              )) : null}
            </div>
          )) : (
            <div className="no-grid">No grid data available</div>
          )}
        </div>
      </div>

      {!guessesRevealed ? (
        <div className="guess-input-section">
          <h3>Time to Reveal Your Guesses!</h3>
          <p>Write down what object or creature you think this shape represents:</p>
          
          <div className="guess-inputs">
            <div className="guess-input-group">
              <label>{playerNames.player1Name}'s Guess:</label>
              <input
                type="text"
                value={player1Guess}
                onChange={(e) => setPlayer1Guess(e.target.value)}
                placeholder="What do you see in this shape?"
              />
            </div>
            
            <div className="guess-input-group">
              <label>{playerNames.player2Name}'s Guess:</label>
              <input
                type="text"
                value={player2Guess}
                onChange={(e) => setPlayer2Guess(e.target.value)}
                placeholder="What do you see in this shape?"
              />
            </div>
          </div>
          
          <button 
            className="reveal-button"
            onClick={handleRevealGuesses}
            disabled={!player1Guess.trim() || !player2Guess.trim()}
          >
            Reveal Guesses!
          </button>
        </div>
      ) : (
        <div className="guess-results">
          <h3>The Reveal!</h3>
          <div className="guesses">
            <div className="guess-result">
              <strong>{playerNames.player1Name} saw:</strong> "{player1Guess}"
            </div>
            <div className="guess-result">
              <strong>{playerNames.player2Name} saw:</strong> "{player2Guess}"
            </div>
          </div>
          
          <div className="match-analysis">
            {player1Guess.toLowerCase().trim() === player2Guess.toLowerCase().trim() ? (
              <div className="perfect-match">
                🎉 Perfect Match! You both saw the same thing! 🎉
              </div>
            ) : (
              <div className="different-interpretations">
                🤔 Different interpretations - that's the beauty of creative foraging! 🎨
              </div>
            )}
          </div>
          
          <div className="action-buttons">
            <button className="save-shape-button" onClick={handleSaveShape}>
              Save to Gallery
            </button>
            <button className="new-game-button" onClick={onNewGame}>
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
