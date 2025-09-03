import React from 'react';
import './MainMenu.css';

export default function MainMenu({ onSelectGameMode, showGallery, galleryCount }) {
  return (
    <div className="main-menu">
      <div className="menu-header">
        <h1>Creative Foraging</h1>
        <p className="tagline">A silent, sculpting-and-guessing game</p>
      </div>

      <div className="game-modes">
        <div className="mode-card available" onClick={() => onSelectGameMode('offline')}>
          <div className="mode-icon">
            <img src="https://i.imgur.com/LzMFwvl.png" alt="Offline" />
          </div>
          <h3>Offline Game</h3>
          <p>Two players on the same device</p>
          <div className="mode-status">Available</div>
        </div>

        <div className="mode-card available" onClick={() => onSelectGameMode('online')}>
          <div className="mode-icon">
            <img src="https://i.imgur.com/zigkT9o.png" alt="Online" />
          </div>
          <h3>Online Game</h3>
          <p>Play with friends over the internet</p>
          <div className="mode-status">Available</div>
        </div>
      </div>

      <div className="menu-actions">
        <button className="gallery-button" onClick={showGallery}>
          <span className="button-icon">🖼️</span>
          View Gallery ({galleryCount})
        </button>
      </div>

      <div className="game-info">
        <h3>How to Play</h3>
        <div className="rules-preview">
          <ul>
            <li>Reshape 10 blocks into recognizable objects</li>
            <li>Keep all blocks connected (no diagonal connections)</li>
            <li>Take turns moving blocks silently</li>
            <li>Guess what your partner is creating</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
