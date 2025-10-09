import React, { useState, useEffect, useRef } from 'react';
import { allowedMoves } from '../utils/grid';
import socketService from '../services/socket';
import './Board.css';

export default function Board({ 
  currentPlayer, 
  onTurnEnd, 
  onSave, 
  gameState, 
  isGameActive,
  onShapeComplete,
  gameMode = 'offline',
  multiplayerData = null
}) {
  const gridSize = 10;
  const cellSize = 40;
  const tileMargin = 2;
  
  // Initial 10-block shape: single horizontal line centered
  const centerY = Math.floor(gridSize / 2);
  const initialTiles = Array.from({ length: 10 }).map((_, i) => ({ 
    x: i, 
    y: centerY 
  }));
  
  const [tiles, setTiles] = useState(initialTiles);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [moves, setMoves] = useState([]);
  const [moveCount, setMoveCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [blocksMovedThisTurn, setBlocksMovedThisTurn] = useState(0);
  const [history, setHistory] = useState([]);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const [summary, setSummary] = useState(null);
  const replayInterval = useRef(null);
  
  // Multiplayer specific states
  const [isMultiplayer] = useState(gameMode === 'online');
  const [isGameLocked, setIsGameLocked] = useState(false);
  const [lockOwner, setLockOwner] = useState(null);
  const [connectedPlayers, setConnectedPlayers] = useState([]);
  const [currentPlayerId, setCurrentPlayerId] = useState(null);

  // Reset game state when a new game starts
  useEffect(() => {
    if (gameState === 'setup') {
      setTiles(initialTiles);
      setSelectedIndex(null);
      setMoves([]);
      setMoveCount(0);
      setStatusMessage('');
      setBlocksMovedThisTurn(0);
      setIsGameLocked(false);
      setLockOwner(null);
      setHistory([initialTiles]);
      setReplayIndex(0);
      setIsReplaying(false);
    }
  }, [gameState]);

  // Initialize multiplayer data and socket listeners
  useEffect(() => {
    if (isMultiplayer && multiplayerData) {
      setCurrentPlayerId(socketService.getCurrentPlayerId());
      setConnectedPlayers(multiplayerData.players || []);
      
      // Set up socket event listeners for multiplayer
      const handleGameStateUpdate = (data) => {
        console.log('Game state updated:', data);
        setTiles(data.tiles);
        setMoveCount(data.moveCount || 0);
        if (data.lastMove) {
          setStatusMessage(`Move by ${data.lastMove.playerId === currentPlayerId ? 'You' : 'Other player'}`);
        }
        
        // Record move in history
        if (data.lastMove) {
          setHistory(prev => [...prev, data.tiles]);
        }
      };

      const handleMoveLocked = (data) => {
        console.log('Game locked:', data);
        setIsGameLocked(true);
        setLockOwner(data.playerId);
        if (data.playerId !== currentPlayerId) {
          setStatusMessage('Other player is making a move...');
          setSelectedIndex(null);
          setMoves([]);
        }
      };

      const handleMoveUnlocked = (data) => {
        console.log('Game unlocked:', data);
        setIsGameLocked(false);
        setLockOwner(null);
        setStatusMessage('');
      };

      const handleMoveAccepted = (data) => {
        console.log('Move accepted:', data);
        if (data.gameState) {
          setTiles(data.gameState.tiles);
          setMoveCount(data.gameState.moveCount || 0);
        }
        setSelectedIndex(null);
        setMoves([]);
        setStatusMessage('Your move was successful!');
      };

      const handleMoveRejected = (data) => {
        console.log('Move rejected:', data);
        setSelectedIndex(null);
        setMoves([]);
        setStatusMessage(`Move rejected: ${data.reason}`);
        setTimeout(() => setStatusMessage(''), 3000);
      };

      const handleGameCompleted = (data) => {
        console.log('Game completed:', data);
        // Handle game completion
        const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
        if (data.completionData && data.completionData.finalGrid) {
          onShapeComplete(data.completionData.finalGrid, moveCount, history);
        }
      };

      const handleGameEnded = (data) => {
        console.log('Game ended:', data);
        setStatusMessage('Game ended');
      };

      const handleGameSummary = (data) => {
        console.log('Game summary received:', data);
        setSummary(data.summary);
      };

      const handleAllowedMoves = (data) => {
        if (data.tileIndex === selectedIndex) {
          setMoves(data.moves);
        }
      };

      const handleLockAcquired = (data) => {
        console.log('[Board] Lock acquired by player:', data.playerId);
        setLockOwner(data.playerId);
        setIsGameLocked(true);
        if (data.playerId !== currentPlayerId) {
          setStatusMessage('Other player is making a move...');
        }
      };

      const handleLockReleased = (data) => {
        console.log('[Board] Lock released by player:', data.playerId);
        setLockOwner(null);
        setIsGameLocked(false);
        setStatusMessage('');
      };

      const handleMoveLockGranted = (data) => {
        console.log('[Board] Move lock granted for tile:', data.tileIndex);
        setMoves(data.moves);
        setStatusMessage('Lock acquired! Make your move.');
      };

      const handleMoveLockDenied = (data) => {
        console.log('[Board] Move lock denied:', data.reason);
        setStatusMessage('Another player is already moving. Please wait.');
        // Clear selection since we couldn't get the lock
        setSelectedIndex(null);
        setMoves([]);
      };

      // Register socket event listeners
      socketService.on('game-state-update', handleGameStateUpdate);
      socketService.on('move-locked', handleMoveLocked);
      socketService.on('move-unlocked', handleMoveUnlocked);
      socketService.on('move-accepted', handleMoveAccepted);
      socketService.on('move-rejected', handleMoveRejected);
      socketService.on('game-completed', handleGameCompleted);
  socketService.on('game-ended', handleGameEnded);
  socketService.on('game-summary', handleGameSummary);
      socketService.on('allowed-moves', handleAllowedMoves);
      socketService.on('lock-acquired', handleLockAcquired);
      socketService.on('lock-released', handleLockReleased);
      socketService.on('move-lock-granted', handleMoveLockGranted);
      socketService.on('move-lock-denied', handleMoveLockDenied);

      // Cleanup function
      return () => {
        socketService.off('game-state-update', handleGameStateUpdate);
        socketService.off('move-locked', handleMoveLocked);
        socketService.off('move-unlocked', handleMoveUnlocked);
        socketService.off('move-accepted', handleMoveAccepted);
        socketService.off('move-rejected', handleMoveRejected);
        socketService.off('game-completed', handleGameCompleted);
  socketService.off('game-ended', handleGameEnded);
  socketService.off('game-summary', handleGameSummary);
        socketService.off('allowed-moves', handleAllowedMoves);
        socketService.off('lock-acquired', handleLockAcquired);
        socketService.off('lock-released', handleLockReleased);
        socketService.off('move-lock-granted', handleMoveLockGranted);
        socketService.off('move-lock-denied', handleMoveLockDenied);
      };
    }
  }, [isMultiplayer, multiplayerData, currentPlayerId, selectedIndex, moveCount, onShapeComplete, gridSize]);

  const handleCellClick = (col, row) => {
    if (!isGameActive || gameState !== 'playing') return;
    
    // For multiplayer, check if game is locked by another player
    if (isMultiplayer && isGameLocked && lockOwner !== currentPlayerId) {
      setStatusMessage('Another player is currently making a move. Please wait...');
      return;
    }

    // If a tile is selected, try to move it or deselect it
    if (selectedIndex !== null) {
      const selectedTile = tiles[selectedIndex];
      
      // Check if clicking the same tile to deselect
      if (selectedTile.x === col && selectedTile.y === row) {
        console.log('[Board] Deselecting tile and releasing lock');
        setSelectedIndex(null);
        setMoves([]);
        setStatusMessage('Block deselected');
        
        // Release lock in multiplayer
        if (isMultiplayer) {
          socketService.releaseMove();
        }
        return;
      }

      // Try to move to clicked position
      const move = moves.find(m => m.x === col && m.y === row);
      if (move) {
        if (isMultiplayer) {
          // For multiplayer, check if we already have the lock
          if (isGameLocked && lockOwner === currentPlayerId) {
            // We have the lock, make the move directly
            try {
              socketService.makeLockedMove(selectedIndex, { x: col, y: row });
              setStatusMessage('Making move...');
            } catch (error) {
              setStatusMessage(`Error: ${error.message}`);
              setSelectedIndex(null);
              setMoves([]);
            }
          } else {
            // We don't have the lock, use the old system
            try {
              socketService.attemptMove(selectedIndex, { x: col, y: row });
              setStatusMessage('Sending move...');
            } catch (error) {
              setStatusMessage(`Error: ${error.message}`);
              setSelectedIndex(null);
              setMoves([]);
            }
          }
        } else {
          // For offline mode, handle move locally
          const newTiles = tiles.map((t, i) => 
            i === selectedIndex ? { x: col, y: row } : t
          );
          setTiles(newTiles);
          setMoveCount(prev => prev + 1);
          setBlocksMovedThisTurn(prev => prev + 1);
          setStatusMessage(`Player ${currentPlayer} moved a block! (${blocksMovedThisTurn + 1} blocks moved this turn)`);
          
          // Log board data after move
          const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
          newTiles.forEach(({ x, y }) => {
            if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
              grid[gridSize - 1 - y][x] = 1;
            }
          });
          console.log(`Player ${currentPlayer} - Move ${moveCount + 1}:`, {
            tiles: newTiles,
            grid: grid,
            move: `Block moved from (${tiles[selectedIndex].x},${tiles[selectedIndex].y}) to (${col},${row})`
          });
          
          setSelectedIndex(null);
          setMoves([]);
        }
      }
      return;
    }

    // Try to select a tile
    const idx = tiles.findIndex(t => t.x === col && t.y === row);
    if (idx >= 0) {
      if (isMultiplayer) {
        // For multiplayer, request lock and get allowed moves from server
        console.log('[Board] Requesting move lock and allowed moves for tile:', idx);
        try {
          socketService.requestMove(idx);  // This will trigger lock request
          setSelectedIndex(idx);
          setStatusMessage('Requesting lock and getting available moves...');
        } catch (error) {
          setStatusMessage(`Error: ${error.message}`);
        }
      } else {
        // For offline mode, calculate moves locally
        const allowed = allowedMoves(tiles, idx);
        if (allowed.length > 0) {
          setSelectedIndex(idx);
          setMoves(allowed);
          console.log(`Player ${currentPlayer} selected block at (${col},${row}), valid moves:`, allowed);
        } else {
          setStatusMessage('This block cannot be moved (would break connectivity)');
          console.log(`Player ${currentPlayer} tried to select unmovable block at (${col},${row})`);
        }
      }
    }
  };

  const handleEndTurn = () => {
    setSelectedIndex(null);
    setMoves([]);
    setBlocksMovedThisTurn(0);
    setStatusMessage('');
    onTurnEnd();
  };

  const handleCompleteShape = () => {
    // Convert tiles to grid format for saving
    const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
    tiles.forEach(({ x, y }) => {
      if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        grid[gridSize - 1 - y][x] = 1;
      }
    });
    
    if (isMultiplayer) {
      try {
        socketService.completeShape(grid);
        setStatusMessage('Completing shape...');
      } catch (error) {
        setStatusMessage(`Error: ${error.message}`);
      }
    } else {
      onShapeComplete(grid, moveCount, history);
    }
  };

  const renderPlayerStatus = () => {
    if (!isGameActive) return null;
    
    if (isMultiplayer) {
      const currentPlayerInfo = connectedPlayers.find(p => p.id === currentPlayerId);
      const otherPlayers = connectedPlayers.filter(p => p.id !== currentPlayerId);
      
      return (
        <div className="player-status multiplayer">
          <div className="player-info">
            <h2>You: {currentPlayerInfo?.name || 'Unknown'}</h2>
            <div className="multiplayer-status">
              {isGameLocked ? (
                <div className={`lock-status ${lockOwner === currentPlayerId ? 'you-have-lock' : 'other-has-lock'}`}>
                  {lockOwner === currentPlayerId ? '🔒 Your turn' : '⏳ Other player\'s turn'}
                </div>
              ) : (
                <div className="lock-status available">
                  ✨ Ready to move
                </div>
              )}
            </div>
          </div>
          
          <div className="other-players">
            <h3>Other Players:</h3>
            {otherPlayers.map(player => (
              <div key={player.id} className="other-player">
                <span className="player-name">{player.name}</span>
                <span className="player-connection">
                  {player.connected ? '🟢' : '🔴'}
                </span>
              </div>
            ))}
          </div>
          
          <div className="game-stats">
            <p>Total moves: {moveCount}</p>
            <button 
              className="complete-shape-button" 
              onClick={handleCompleteShape}
              disabled={moveCount === 0 || (isGameLocked && lockOwner !== currentPlayerId)}
            >
              Complete Shape
            </button>
            <button
              className="end-game-button"
              onClick={() => {
                try { socketService.endGame(); } catch (e) { setStatusMessage(e.message); }
              }}
              disabled={roomManager && false}
            >
              End Game
            </button>
            <button
              className="save-shape-button"
              onClick={() => {
                const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
                tiles.forEach(({ x, y }) => { 
                  if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
                    grid[gridSize - 1 - y][x] = 1; 
                  }
                });
                
                const shapeData = {
                  grid,
                  timestamp: new Date().toISOString(),
                  moves: moveCount,
                  players: { player1Name: 'You', player2Name: 'Opponent' },
                  gameMode: 'multiplayer'
                };
                
                onSave(shapeData);
                try { socketService.saveShape(grid, 'Shape'); } catch {}
                setStatusMessage('Shape saved to gallery!');
                setTimeout(() => setStatusMessage(''), 3000);
              }}
              disabled={moveCount === 0 || (isGameLocked && lockOwner !== currentPlayerId)}
            >
              Save Shape to Gallery
            </button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="player-status">
        <h2>Player {currentPlayer}'s Turn</h2>
        <p>Blocks moved this turn: {blocksMovedThisTurn}</p>
        <p>Total moves: {moveCount}</p>
       {false ? <button className="end-turn-button" onClick={handleEndTurn}>
          End Turn
        </button> : null}
        <button 
          className="complete-shape-button" 
          onClick={handleCompleteShape}
          disabled={moveCount === 0}
        >
          Complete Shape
        </button>
        <button 
          className="end-game-button" 
          onClick={() => {
            // Offline: just mark completed and show local summary
            setStatusMessage('Game ended');
            const localSummary = {
              roomId: 'offline',
              perUser: { 'Player 1': { moves: moveCount, saves: 0 }, 'Player 2': { moves: 0, saves: 0 } },
              totalMoves: moveCount,
              totalSaves: 0,
              moves: history.slice(1).map((tilesAtStep, i) => ({ user: `Player ${currentPlayer}`, step: i + 1 })),
              saves: []
            };
            setSummary(localSummary);
          }}
          disabled={moveCount === 0}
        >
          End Game
        </button>
        <button
          className="save-shape-button"
          onClick={() => {
            const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
            tiles.forEach(({ x, y }) => { 
              if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
                grid[gridSize - 1 - y][x] = 1; 
              }
            });
            
            const shapeData = {
              grid,
              timestamp: new Date().toISOString(),
              moves: moveCount,
              players: { player1Name: 'Player 1', player2Name: 'Player 2' },
              gameMode: 'offline'
            };
            
            onSave(shapeData);
            setStatusMessage('Shape saved to gallery!');
            setTimeout(() => setStatusMessage(''), 3000);
          }}
          disabled={moveCount === 0}
        >
          Save Shape to Gallery
        </button>
      </div>
    );
  };

  // Determine tiles to display: during replay use history
  const displayTiles = isReplaying || replayIndex > 0 ? history[replayIndex] : tiles;

  return (
    <div className="board-container">
      {renderPlayerStatus()}
      
      <div className="grid" style={{ 
        position: 'relative', 
        width: gridSize * cellSize, 
        height: gridSize * cellSize, 
        pointerEvents: !isGameActive ? 'none' : 'auto',
        border: isMultiplayer && isGameLocked && lockOwner !== currentPlayerId 
          ? '2px solid #ff6b47' 
          : '2px solid #0f0',
        backgroundColor: '#000',
        transition: 'border-color 0.3s ease'
      }}>
        {Array.from({ length: gridSize }).flatMap((_, row) =>
          Array.from({ length: gridSize }).map((_, col) => {
            const tileIdx = displayTiles.findIndex(t => t.x === col && t.y === row);
            const hasTile = tileIdx >= 0;
            const isSelected = tileIdx === selectedIndex;
            const isMoveOption = moves.some(m => m.x === col && m.y === row);
            const isLockedByOther = isMultiplayer && isGameLocked && lockOwner !== currentPlayerId;
            
            // Calculate background color
            let backgroundColor;
            if (hasTile) {
              if (isLockedByOther) {
                // Locked by other player - use orange/light red tint
                backgroundColor = currentPlayer === 1 ? '#ff6b47' : '#ff9944';
              } else {
                // Normal player colors
                backgroundColor = currentPlayer === 1 ? '#0f0' : '#f90';
              }
            } else if (isMoveOption && !isLockedByOther) {
              backgroundColor = '#004d00';
            } else {
              backgroundColor = 'transparent';
            }
            
            return (
              <div
                key={`${col}-${row}`}
                onClick={() => handleCellClick(col, row)}
                style={{
                  width: cellSize - tileMargin * 2,
                  height: cellSize - tileMargin * 2,
                  boxSizing: 'border-box',
                  position: 'absolute',
                  left: col * cellSize + tileMargin,
                  top: (gridSize - 1 - row) * cellSize + tileMargin,
                  background: backgroundColor,
                  cursor: (hasTile || isMoveOption) && !isLockedByOther ? 'pointer' : 'default',
                  outline: isSelected ? '3px solid orange' : 'none',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease',
                  opacity: isLockedByOther ? 0.7 : 1,
                }}
              />
            );
          })
        )}
      </div>
      
      <div className="status-bar">
        {statusMessage && <p>{statusMessage}</p>}
        {!statusMessage && isGameActive && !isMultiplayer && (
          <p>
            {selectedIndex !== null 
              ? 'Click a highlighted cell to move the selected block' 
              : 'Click an edge block to select, then click a highlighted cell to move it'
            }
          </p>
        )}
        {!statusMessage && isGameActive && isMultiplayer && (
          <p>
            {isGameLocked && lockOwner !== currentPlayerId
              ? 'Waiting for other player to finish their move...'
              : selectedIndex !== null 
              ? 'Click a highlighted cell to move the selected block' 
              : 'Click a block to select, then click a highlighted cell to move it'
            }
          </p>
        )}
      </div>
      
      {gameState === 'completed' && history.length > 1 && (
        <div className="replay-controls">
          <button onClick={() => setIsReplaying(!isReplaying)}>
            {isReplaying ? 'Pause' : 'Play'} Replay
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

      {summary && (
        <div className="summary-panel" style={{ marginTop: 16 }}>
          <h3>Game Summary</h3>
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <p>Room: {summary.roomId}</p>
              <p>Total Moves: {summary.totalMoves}</p>
              <p>Total Saves: {summary.totalSaves}</p>
              {summary.startedBy && <p>Started by: {summary.startedBy}</p>}
              {summary.endedBy && <p>Ended by: {summary.endedBy}</p>}
            </div>
            <div>
              <table style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ borderBottom: '1px solid #444', padding: '4px 8px' }}>Player</th>
                    <th style={{ borderBottom: '1px solid #444', padding: '4px 8px' }}>Moves</th>
                    <th style={{ borderBottom: '1px solid #444', padding: '4px 8px' }}>Saves</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary.perUser || {}).map(([user, stats]) => (
                    <tr key={user}>
                      <td style={{ borderBottom: '1px solid #333', padding: '4px 8px' }}>{user}</td>
                      <td style={{ borderBottom: '1px solid #333', padding: '4px 8px' }}>{stats.moves}</td>
                      <td style={{ borderBottom: '1px solid #333', padding: '4px 8px' }}>{stats.saves}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {summary.saves && summary.saves.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <h4>Saved Shapes</h4>
              <ul>
                {summary.saves.map((s, i) => (
                  <li key={i}>{s.user} saved "{s.name}" at {new Date(s.ts).toLocaleTimeString()}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
