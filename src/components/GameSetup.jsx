import React, { useState } from 'react';
import './GameSetup.css';

export default function GameSetup({ onStartGame, gameState }) {
  const [player1Name, setPlayer1Name] = useState('Player 1');
  const [player2Name, setPlayer2Name] = useState('Player 2');
  const [moveLimit, setMoveLimit] = useState(20);

  const handleStartGame = () => {
    onStartGame({
      player1Name,
      player2Name,
      moveLimit
    });
  };

  if (gameState !== 'setup') return null;

  return (
    <div className="game-setup">
      <h1>Offline Creative Foraging</h1>
      <p className="game-description">
        A silent, sculpting-and-guessing game for two players on the same device. 
        Work together to reshape 10 blocks into meaningful silhouettes. No talking allowed - let your moves do the talking!
      </p>
      
      <div className="setup-form">
        <div className="form-group">
          <label htmlFor="player1">Player 1 Name:</label>
          <input
            id="player1"
            type="text"
            value={player1Name}
            onChange={(e) => setPlayer1Name(e.target.value)}
            placeholder="Enter Player 1 name"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="player2">Player 2 Name:</label>
          <input
            id="player2"
            type="text"
            value={player2Name}
            onChange={(e) => setPlayer2Name(e.target.value)}
            placeholder="Enter Player 2 name"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="moveLimit">Move Limit (optional):</label>
          <input
            id="moveLimit"
            type="number"
            min="10"
            max="50"
            value={moveLimit}
            onChange={(e) => setMoveLimit(parseInt(e.target.value) || 20)}
          />
        </div>
        
        <button className="start-game-button" onClick={handleStartGame}>
          Start Creative Foraging
        </button>
      </div>
      
      <div className="game-rules">
        <h3>Game Rules</h3>
        <ul>
          <li>Always maintain exactly 10 blocks on the board</li>
          <li>All blocks must form one connected shape (no diagonal connections)</li>
          <li>You can only move edge blocks that won't break connectivity</li>
          <li>On your turn, move one or more blocks, then end your turn</li>
          <li>No talking or hinting allowed - let your moves speak!</li>
          <li>When satisfied with the shape, reveal your guesses</li>
        </ul>
      </div>
    </div>
  );
}
