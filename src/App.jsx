import React, { useState } from 'react';
import MainMenu from './components/MainMenu';
import GameSetup from './components/GameSetup';
import Board from './components/Board';
import BoardClick from './components/BoardClick';
import BoardDrag from './components/BoardDrag';
import { GAMEPLAY_VARIANT } from './gameplayConfig';
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
  const [savedGames, setSavedGames] = useState([]);
  const [showGallery, setShowGallery] = useState(false);
  const [multiplayerData, setMultiplayerData] = useState(null);

  // Load saved games from localStorage on app start
  React.useEffect(() => {
    const saved = localStorage.getItem('foraging-game-summaries');
    if (saved) {
      try {
        setSavedGames(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load saved games:', error);
      }
    }
  }, []);

  // Save games to localStorage whenever savedGames changes
  React.useEffect(() => {
    localStorage.setItem('foraging-game-summaries', JSON.stringify(savedGames));
  }, [savedGames]);

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

  // Save a full game summary to gallery
  const handleSaveGameSummary = (gameSummary) => {
    setSavedGames(prev => [gameSummary, ...prev]);
    console.log('Game summary saved to gallery:', gameSummary);
  };

  const handleLoadGame = (gameSummary) => {
    // This could be used to load a game summary as a starting point for a new game
    console.log('Load game requested:', gameSummary);
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
              Gallery ({savedGames.length})
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
          galleryCount={savedGames.length}
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
        GAMEPLAY_VARIANT === 'drag' ? (
          <BoardDrag
            currentPlayer={currentPlayer}
            onTurnEnd={handleTurnEnd}
            onSave={handleSaveGameSummary}
            gameState={appState}
            isGameActive={true}
            onShapeComplete={handleShapeComplete}
            gameMode={gameMode}
            multiplayerData={multiplayerData}
          />
        ) : (
          <BoardClick
            currentPlayer={currentPlayer}
            onTurnEnd={handleTurnEnd}
            onSave={handleSaveGameSummary}
            gameState={appState}
            isGameActive={true}
            onShapeComplete={handleShapeComplete}
            gameMode={gameMode}
            multiplayerData={multiplayerData}
          />
        )
      )}

      {appState === 'reveal' && !showGallery && (
        <GuessReveal
          gameState={appState}
          finalGrid={finalGrid}
          totalMoves={totalMoves}
          history={gameHistory}
          onNewGame={handleNewGame}
          onSaveGameSummary={handleSaveGameSummary}
          playerNames={playerNames}
        />
      )}

      {showGallery && (
        <Gallery
          savedGames={savedGames}
          onClose={() => setShowGallery(false)}
          onLoadGame={handleLoadGame}
        />
      )}
    </div>
  );
}

export default App;
