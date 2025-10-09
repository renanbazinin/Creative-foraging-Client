import React, { useState, useEffect } from 'react';
import './Gallery.css';
import SummaryPanel from './SummaryPanel';

export default function Gallery({ savedGames, onClose, onLoadGame }) {
  const [selectedGame, setSelectedGame] = useState(null);
  const [localGames, setLocalGames] = useState([]);
  useEffect(() => {
    const loaded = localStorage.getItem('foraging-game-summaries');
    try {
      const parsed = JSON.parse(loaded) || [];
      setLocalGames(parsed);
      console.log('[Gallery] Loaded from localStorage:', parsed);
    } catch {
      setLocalGames([]);
      console.log('[Gallery] No valid game summaries found in localStorage.');
    }
  }, []);

  if (!localGames || localGames.length === 0) {
    return (
      <div className="gallery-overlay">
        <div className="gallery">
          <div className="gallery-header">
            <h2>Game Gallery</h2>
            <button className="close-button" onClick={onClose}>✕</button>
          </div>
          <div className="empty-gallery">
            <p>No games saved yet. Play and save a game to see it here!</p>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Compact preview for each game
  const renderMiniGrid = (grid, size = 8) => {
    if (!grid || !grid.length) return null;
    return (
      <div className="gallery-mini-grid" style={{ gridTemplateColumns: `repeat(${grid[0].length}, ${size}px)` }}>
        {grid.map((row, rowIdx) =>
          row.map((cell, colIdx) => (
            <div
              key={`${rowIdx}-${colIdx}`}
              className={`gallery-mini-cell ${cell === 1 ? 'filled' : 'empty'}`}
              style={{ width: `${size}px`, height: `${size}px` }}
            />
          ))
        )}
      </div>
    );
  };
  // Debug: log all games present in gallery
  console.debug('[Gallery] Presenting games:', savedGames);
  return (
    <div className="gallery-overlay">
      <div className="gallery">
        <div className="gallery-header">
          <h2>Game Gallery ({localGames.length} games)</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        <div className="gallery-content">
          {!selectedGame ? (
            <div className="gallery-cards-grid">
              {localGames.map((game, index) => {
                console.debug('[Gallery] Showing game:', game);
                return (
                  <div
                    key={game.id ?? index}
                    className="gallery-card"
                    onClick={() => setSelectedGame(game)}
                    title="Click to view moves"
                  >
                    <div className="gallery-card-preview">
                      {game.grid && renderMiniGrid(game.grid, 8)}
                    </div>
                    <div className="gallery-card-info">
                      <div className="gallery-card-title">
                        {game.players
                          ? `${game.roomId}`
                          : `Game ${index}`}
                      </div>
                      <div className="gallery-card-moves">{game.moves} moves</div>
                      {(game.player1Guess || game.player2Guess) && (
                        <div className="gallery-card-guesses">
                          <span>Guesses:</span>
                          {game.player1Guess && (
                            <span>{game.players?.player1Name || 'Player 1'}: "{game.player1Guess}"</span>
                          )}
                          {game.player2Guess && (
                            <span>{game.players?.player2Name || 'Player 2'}: "{game.player2Guess}"</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="gallery-detail">
              <button
                className="back-button"
                onClick={() => setSelectedGame(null)}
              >
                ← Back to Gallery
              </button>
              <div className="gallery-detail-content">
                <SummaryPanel
                  summary={selectedGame}
                  players={selectedGame.players ? [
                    { id: 1, name: selectedGame.players.player1Name },
                    { id: 2, name: selectedGame.players.player2Name }
                  ] : []}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
