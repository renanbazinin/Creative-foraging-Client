import React, { useState } from 'react';
import MainMenu from './components/MainMenu';
import GameSetup from './components/GameSetup';
import Board from './components/Board';
import GuessReveal from './components/GuessReveal';
import Gallery from './components/Gallery';
import MultiplayerLobby from './components/MultiplayerLobby';
import './App.css';

function App() {
  // Log the base URL so we can verify correct asset resolution on GitHub Pages
  if (typeof window !== 'undefined') {
    // Only logs once per load
    if (!window.__BASE_LOGGED__) {
      console.log('[Creative Foraging] Deployed base URL:', import.meta.env.BASE_URL);
      window.__BASE_LOGGED__ = true;
    }
  }
  const [appState, setAppState] = useState('menu'); // 'menu', 'setup', 'lobby', 'playing', 'reveal'
  const [gameMode, setGameMode] = useState(null); // 'offline', 'online', 'video'
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [playerNames, setPlayerNames] = useState({ player1Name: 'Player 1', player2Name: 'Player 2' });
  const [moveLimit, setMoveLimit] = useState(20);
  const [finalGrid, setFinalGrid] = useState(null);
  const [totalMoves, setTotalMoves] = useState(0);
  const [gameHistory, setGameHistory] = useState([]);
  const [savedShapes, setSavedShapes] = useState([]);
  const [showGallery, setShowGallery] = useState(false);
  const [multiplayerData, setMultiplayerData] = useState(null);

  // Load saved shapes from localStorage on app start
  React.useEffect(() => {
    const saved = localStorage.getItem('foraging-game-shapes');
    if (saved) {
      try {
        setSavedShapes(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load saved shapes:', error);
      }
    }
  }, []);

  // Save shapes to localStorage whenever savedShapes changes
  React.useEffect(() => {
    localStorage.setItem('foraging-game-shapes', JSON.stringify(savedShapes));
  }, [savedShapes]);

  const handleSelectGameMode = (mode) => {
    setGameMode(mode);
    if (mode === 'offline') {
      setAppState('setup');
    } else if (mode === 'online') {
      setAppState('lobby');
    } else {
      // For future modes like video
      console.log(`${mode} mode selected - coming soon!`);
    }
  };

  const handleMultiplayerGameStart = (gameData) => {
    setMultiplayerData(gameData);
    setGameMode('online');
    setAppState('playing');
    console.log('Multiplayer game started:', gameData);
  };

  const handleStartGame = (setupData) => {
    setPlayerNames({ 
      player1Name: setupData.player1Name, 
      player2Name: setupData.player2Name 
    });
    setMoveLimit(setupData.moveLimit);
    setCurrentPlayer(1);
    setAppState('playing');
    setTotalMoves(0);
    console.log('Game started:', { mode: gameMode, players: setupData, moveLimit: setupData.moveLimit });
  };

  const handleTurnEnd = () => {
    const nextPlayer = currentPlayer === 1 ? 2 : 1;
    setCurrentPlayer(nextPlayer);
    console.log(`Turn ended. Next player: ${nextPlayer}`);
  };

  const handleShapeComplete = (grid, moves, history = []) => {
    setFinalGrid(grid);
    setTotalMoves(moves);
    setGameHistory(history);
    setAppState('reveal');
    console.log('Shape completed:', { grid, moves, history, gameMode });
  };

  const handleNewGame = () => {
    setAppState('menu');
    setGameMode(null);
    setCurrentPlayer(1);
    setFinalGrid(null);
    setTotalMoves(0);
    setGameHistory([]);
    setMultiplayerData(null);
    console.log('Returning to main menu');
  };

  const handleBackToMenu = () => {
    setAppState('menu');
    setGameMode(null);
    setMultiplayerData(null);
    console.log('Returned to main menu');
  };

  const handleSaveShape = (shapeData) => {
    // If it's just a grid (old format), convert it to new format
    if (Array.isArray(shapeData)) {
      const convertedShapeData = {
        grid: shapeData,
        timestamp: new Date().toISOString(),
        moves: totalMoves || 0,
        players: playerNames,
        gameMode: gameMode || 'offline'
      };
      setSavedShapes(prev => [convertedShapeData, ...prev]);
      console.log('Shape saved to gallery (converted):', convertedShapeData);
    } else {
      // New format - save directly
      setSavedShapes(prev => [shapeData, ...prev]);
      console.log('Shape saved to gallery:', shapeData);
    }
  };

  const handleSaveToGallery = (shapeData) => {
    setSavedShapes(prev => [shapeData, ...prev]);
    console.log('Shape saved to gallery:', shapeData);
  };

  const handleLoadShape = (grid) => {
    // This could be used to load a shape as a starting point for a new game
    console.log('Load shape requested:', grid);
  };

  return (
    <div className="app">
      {(appState !== 'menu' && !showGallery) && (
        <div className="app-header">
          <h1>Creative Foraging {gameMode === 'online' ? '- Multiplayer' : gameMode === 'offline' ? '- Offline Mode' : ''}</h1>
          <div className="app-nav">
            <button 
              className="nav-button"
              onClick={() => setShowGallery(true)}
              disabled={appState === 'playing'}
            >
              Gallery ({savedShapes.length})
            </button>
            <button 
              className="nav-button back-to-menu" 
              onClick={handleBackToMenu}
            >
              Back to Menu
            </button>
          </div>
        </div>
      )}

      {appState === 'menu' && !showGallery && (
        <MainMenu
          onSelectGameMode={handleSelectGameMode}
          showGallery={() => setShowGallery(true)}
          galleryCount={savedShapes.length}
        />
      )}

      {appState === 'lobby' && !showGallery && (
        <MultiplayerLobby
          onGameStart={handleMultiplayerGameStart}
          onBackToMenu={handleBackToMenu}
        />
      )}

      {appState === 'setup' && !showGallery && (
        <GameSetup 
          gameState={appState}
          onStartGame={handleStartGame}
        />
      )}

      {appState === 'playing' && !showGallery && (
        <Board
          currentPlayer={currentPlayer}
          onTurnEnd={handleTurnEnd}
          onSave={handleSaveShape}
          gameState={appState}
          isGameActive={true}
          onShapeComplete={handleShapeComplete}
          gameMode={gameMode}
          multiplayerData={multiplayerData}
        />
      )}

      {appState === 'reveal' && !showGallery && (
        <GuessReveal
          gameState={appState}
          finalGrid={finalGrid}
          totalMoves={totalMoves}
          history={gameHistory}
          onNewGame={handleNewGame}
          onSaveToGallery={handleSaveToGallery}
          playerNames={playerNames}
        />
      )}

      {showGallery && (
        <Gallery
          savedShapes={savedShapes}
          onClose={() => setShowGallery(false)}
          onLoadShape={handleLoadShape}
        />
      )}
    </div>
  );
}

export default App;
