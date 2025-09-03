import React, { useState } from 'react';
import './Gallery.css';

export default function Gallery({ savedShapes, onClose, onLoadShape }) {
  const [selectedShape, setSelectedShape] = useState(null);

  if (!savedShapes || savedShapes.length === 0) {
    return (
      <div className="gallery-overlay">
        <div className="gallery">
          <div className="gallery-header">
            <h2>Shape Gallery</h2>
            <button className="close-button" onClick={onClose}>✕</button>
          </div>
          <div className="empty-gallery">
            <p>No shapes saved yet. Create some masterpieces first!</p>
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

  const renderShape = (grid, size = 15) => {
    return (
      <div className="mini-shape-grid" style={{ gridTemplateColumns: `repeat(${grid[0].length}, ${size}px)` }}>
        {grid.map((row, rowIdx) =>
          row.map((cell, colIdx) => (
            <div
              key={`${rowIdx}-${colIdx}`}
              className={`mini-shape-cell ${cell === 1 ? 'filled' : 'empty'}`}
              style={{ width: `${size}px`, height: `${size}px` }}
            />
          ))
        )}
      </div>
    );
  };

  return (
    <div className="gallery-overlay">
      <div className="gallery">
        <div className="gallery-header">
          <h2>Shape Gallery ({savedShapes.length} shapes)</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        
        <div className="gallery-content">
          {!selectedShape ? (
            <div className="shapes-grid">
              {savedShapes.map((shape, index) => (
                <div
                  key={index}
                  className="shape-card"
                  onClick={() => setSelectedShape(shape)}
                >
                  <div className="shape-preview">
                    {renderShape(shape.grid, 12)}
                  </div>
                  <div className="shape-info">
                    <div className="shape-date">{formatDate(shape.timestamp)}</div>
                    <div className="shape-moves">{shape.moves} moves</div>
                    {shape.players && (
                      <div className="shape-players">
                        {shape.players.player1Name} & {shape.players.player2Name}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="shape-detail">
              <button 
                className="back-button" 
                onClick={() => setSelectedShape(null)}
              >
                ← Back to Gallery
              </button>
              
              <div className="shape-detail-content">
                <div className="large-shape">
                  {renderShape(selectedShape.grid, 25)}
                </div>
                
                <div className="shape-metadata">
                  <h3>Shape Details</h3>
                  <p><strong>Created:</strong> {formatDate(selectedShape.timestamp)}</p>
                  <p><strong>Total Moves:</strong> {selectedShape.moves}</p>
                  
                  {selectedShape.players && (
                    <div className="players-info">
                      <p><strong>Players:</strong></p>
                      <p>{selectedShape.players.player1Name} & {selectedShape.players.player2Name}</p>
                    </div>
                  )}
                  
                  {selectedShape.player1Guess && selectedShape.player2Guess && (
                    <div className="guesses-info">
                      <h4>What They Saw:</h4>
                      <div className="guess-item">
                        <strong>{selectedShape.players?.player1Name || 'Player 1'}:</strong>
                        <span>"{selectedShape.player1Guess}"</span>
                      </div>
                      <div className="guess-item">
                        <strong>{selectedShape.players?.player2Name || 'Player 2'}:</strong>
                        <span>"{selectedShape.player2Guess}"</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="shape-actions">
                    <button
                      className="load-shape-button"
                      onClick={() => {
                        onLoadShape(selectedShape.grid);
                        onClose();
                      }}
                    >
                      Load This Shape
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
