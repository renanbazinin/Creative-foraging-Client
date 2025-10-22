import React, { useState, useEffect } from 'react';
import socketService from '../services/socket';
import './MultiplayerLobby.css';

export default function MultiplayerLobby({ onGameStart, onBackToMenu }) {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [playerName, setPlayerName] = useState('');
  // Random default name fetched once
  const [isLoadingNames, setIsLoadingNames] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [availableRooms, setAvailableRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [canStartGame, setCanStartGame] = useState(false);
  const [roomStatusMessage, setRoomStatusMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(null);

  // Fetch usernames once and set a single random default
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setIsLoadingNames(true);
        const res = await fetch('https://raw.githubusercontent.com/renanbazinin/justRepoForRawThings/refs/heads/main/fakeUsernames.json');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (active && Array.isArray(data.usernames) && data.usernames.length) {
          const random = data.usernames[Math.floor(Math.random() * data.usernames.length)];
          // Only set if user hasn't typed anything
            setPlayerName(p => p ? p : random);
        }
      } catch (err) {
        console.warn('[Client Lobby] Failed to fetch usernames:', err.message);
      } finally {
        setIsLoadingNames(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    // Connect to server
    setIsLoading(true);
    try {
      socketService.connect();
    } catch (err) {
      setError('Failed to connect to server');
      setIsLoading(false);
    }

    // Set up event listeners
    const handleConnectionStatus = (data) => {
      console.log('[Client Lobby] Connection status:', data);
      setConnectionStatus(data.connected ? 'connected' : 'disconnected');
      setIsLoading(false);
      if (!data.connected) {
        console.log('[Client Lobby] Disconnected - clearing all room state');
        setCurrentRoom(null);
        setPlayers([]);
        setCanStartGame(false);
        setRoomStatusMessage('');
        setStatusMessage('');
        setError('');
      }
      // Don't set state on connection - let normal event handlers manage room state
    };

    const handleConnectionError = (data) => {
      console.log('[Client Lobby] Connection error:', data);
      setError(`Connection error: ${data.error}`);
      setConnectionStatus('error');
      setIsLoading(false);
    };

    const handleRoomCreated = (data) => {
      console.log('[Client Lobby] Room created:', data);
      setCurrentRoom(data.room);
      setPlayers([data.room.players[0]]); // Creator is first player
      setError('');
      setIsLoading(false);
      setCanStartGame(false);
      setRoomStatusMessage('Waiting for another player to join...');
    };

    const handleRoomJoined = (data) => {
      console.log('[Client Lobby] Room joined:', data);
      setCurrentRoom(data.room);
      setPlayers(data.room.players);
      setError('');
      setIsLoading(false);
      setCanStartGame(data.room.players.length >= 2);
      setRoomStatusMessage(data.room.players.length >= 2 ? 'Ready to start!' : 'Waiting for more players...');
    };

    const handlePlayerJoined = (data) => {
      console.log('[Client Lobby] Player joined:', data);
      setPlayers(data.room.players);
      setCanStartGame(data.room.players.length >= 2);
      setRoomStatusMessage(data.room.players.length >= 2 ? 'Ready to start!' : 'Waiting for more players...');
    };

    const handlePlayerLeft = (data) => {
      console.log('[Client Lobby] Player left:', data);
      setPlayers(data.room.players);
      setCanStartGame(data.room.players.length >= 2);
      setRoomStatusMessage(data.room.players.length >= 2 ? 'Ready to start!' : 'Waiting for more players...');
    };

    const handleRoomLeft = () => {
      console.log('[Client Lobby] Left room');
      setCurrentRoom(null);
      setPlayers([]);
      setCanStartGame(false);
      setRoomStatusMessage('');
    };

    const handleAvailableRooms = (data) => {
      console.log('[Client Lobby] Available rooms:', data);
      setAvailableRooms(data.rooms);
      setIsRefreshing(false);
    };

    const handleRoomListUpdated = (data) => {
      console.log('[Client Lobby] Room list updated:', data);
      setAvailableRooms(data.rooms);
    };

    const handleSocketError = (data) => {
      console.log('[Client Lobby] Socket error:', data);
      setError(data.message);
      setIsLoading(false);
    };

    const handleRoomStatusUpdate = (data) => {
      console.log('[Client Lobby] Room status update:', data);
      setCanStartGame(data.canStartGame);
      setRoomStatusMessage(data.message);
      if (data.room) {
        setPlayers(data.room.players);
      }
    };

    const handleGameStateUpdate = (data) => {
      // Game has started - transition to game board
      if (currentRoom && data.tiles) {
        onGameStart({
          roomId: currentRoom.roomId,
          gameState: data,
          players: players
        });
      }
    };

    const handleGameStarted = (data) => {
      // Game has been started - transition to game board
      console.log('[Client Lobby] Game started event received:', data);
      console.log('[Client Lobby] Current room state:', currentRoom);
      console.log('[Client Lobby] Players state:', players);
      console.log('[Client Lobby] onGameStart callback:', typeof onGameStart);
      console.log('[Client Lobby] Event data room:', data.room);
      
      setIsLoading(false);
      setStatusMessage('');
      
      // Use room data from the event instead of React state to avoid stale closure issues
      if (data.room && data.gameState) {
        console.log('[Client Lobby] Calling onGameStart with event data:', {
          roomId: data.room.roomId,
          gameState: data.gameState,
          players: data.room.players,
          isMultiplayer: true
        });
        
        onGameStart({
          roomId: data.room.roomId,
          gameState: data.gameState,
          players: data.room.players,
          isMultiplayer: true
        });
      } else {
        console.error('[Client Lobby] Cannot start game - missing room or gameState in event data!', data);
      }
    };

    // Register event listeners
    socketService.on('connection-status', handleConnectionStatus);
    socketService.on('connection-error', handleConnectionError);
    socketService.on('room-created', handleRoomCreated);
    socketService.on('room-joined', handleRoomJoined);
    socketService.on('player-joined', handlePlayerJoined);
    socketService.on('player-left', handlePlayerLeft);
    socketService.on('room-left', handleRoomLeft);
    socketService.on('available-rooms', handleAvailableRooms);
    socketService.on('room-list-updated', handleRoomListUpdated);
    socketService.on('socket-error', handleSocketError);
    socketService.on('game-state-update', handleGameStateUpdate);
    socketService.on('game-started', handleGameStarted);
    socketService.on('room-status-update', handleRoomStatusUpdate);

    // Cleanup function
    return () => {
      // Clear auto refresh interval
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
      }
      
      socketService.off('connection-status', handleConnectionStatus);
      socketService.off('connection-error', handleConnectionError);
      socketService.off('room-created', handleRoomCreated);
      socketService.off('room-joined', handleRoomJoined);
      socketService.off('player-joined', handlePlayerJoined);
      socketService.off('player-left', handlePlayerLeft);
      socketService.off('room-left', handleRoomLeft);
      socketService.off('available-rooms', handleAvailableRooms);
      socketService.off('room-list-updated', handleRoomListUpdated);
      socketService.off('socket-error', handleSocketError);
      socketService.off('game-state-update', handleGameStateUpdate);
      socketService.off('game-started', handleGameStarted);
      socketService.off('room-status-update', handleRoomStatusUpdate);
    };
  }, []); // Empty dependency array - only run once on mount

  useEffect(() => {
    // Fetch available rooms when connected
    if (connectionStatus === 'connected' && !currentRoom) {
      try {
        socketService.getAvailableRooms();
      } catch (err) {
        console.error('Failed to fetch rooms:', err);
      }
    }
  }, [connectionStatus, currentRoom]);

  // Auto-refresh available rooms when not in a room
  useEffect(() => {
    if (connectionStatus === 'connected' && !currentRoom) {
      // Set up auto-refresh interval (every 5 seconds)
      const interval = setInterval(() => {
        try {
          socketService.getAvailableRooms();
        } catch (err) {
          console.error('Failed to auto-refresh rooms:', err);
        }
      }, 5000);
      
      setAutoRefreshInterval(interval);
      
      return () => {
        clearInterval(interval);
        setAutoRefreshInterval(null);
      };
    } else {
      // Clear auto-refresh when in a room or disconnected
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        setAutoRefreshInterval(null);
      }
    }
  }, [connectionStatus, currentRoom]);

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      socketService.createRoom(playerName.trim());
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (selectedRoomId) => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      socketService.joinRoom(selectedRoomId, playerName.trim());
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handleJoinRoomById = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      socketService.joinRoom(roomId.trim().toUpperCase(), playerName.trim());
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handleLeaveRoom = () => {
    try {
      socketService.leaveRoom();
    } catch (err) {
      setError(err.message);
    }
  };

  const playDingSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Configure the sound
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // Frequency in Hz
      oscillator.type = 'sine'; // Sine wave for a clean tone
      
      // Envelope for the sound (fade out)
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      // Play the sound
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.warn('Failed to play ding sound:', error);
    }
  };

  const handleStartGame = () => {
    console.log('[Client Lobby] Start game button clicked');
    console.log('  - Current room:', currentRoom?.roomId);
    console.log('  - Players count:', players.length);
    console.log('  - Can start game:', canStartGame);
    
    // Play ding sound
    playDingSound();
    
    // Check if socket service actually has room state
    const socketRoomId = socketService.getCurrentRoom();
    console.log('  - Socket service room ID:', socketRoomId);
    
    if (!socketRoomId || !currentRoom) {
      console.log('[Client Lobby] Room state mismatch - clearing local state');
      setCurrentRoom(null);
      setPlayers([]);
      setCanStartGame(false);
      setRoomStatusMessage('');
      setError('Connection lost. Please create or join a room again.');
      return;
    }
    
    if (currentRoom && players.length >= 2 && canStartGame) {
      try {
        setIsLoading(true);
        setError('');
        setStatusMessage('Starting game...');
        
        console.log('[Client Lobby] Sending start game request to server');
        // Send start game request to server
        socketService.startGame();
        
      } catch (error) {
        console.error('[Client Lobby] Failed to start game:', error);
        setError(`Failed to start game: ${error.message}`);
        setIsLoading(false);
        setStatusMessage('');
      }
    } else {
      console.log('[Client Lobby] Cannot start game - conditions not met');
      setError('Need 2 players to start the game');
    }
  };

  const handleRefreshRooms = async () => {
    if (connectionStatus !== 'connected' || currentRoom) {
      return;
    }
    
    setIsRefreshing(true);
    setError('');
    
    try {
      socketService.getAvailableRooms();
    } catch (err) {
      setError('Failed to refresh rooms');
      setIsRefreshing(false);
    }
  };

  const renderConnectionStatus = () => {
    const statusColors = {
      'disconnected': '#ff4444',
      'connected': '#44ff44',
      'error': '#ff8844'
    };

    return (
      <div className="connection-status">
        <div 
          className="status-indicator"
          style={{ backgroundColor: statusColors[connectionStatus] }}
        />
        <span>
          {connectionStatus === 'connected' && 'Connected to server'}
          {connectionStatus === 'disconnected' && 'Connecting...'}
          {connectionStatus === 'error' && 'Connection error'}
        </span>
      </div>
    );
  };

  const renderLobbyContent = () => {
    if (connectionStatus !== 'connected') {
      return (
        <div className="connecting-screen">
          <h2>Connecting to Server...</h2>
          {isLoading && <div className="loading-spinner">⟳</div>}
          {error && <div className="error-message">{error}</div>}
        </div>
      );
    }

    if (currentRoom) {
      return (
        <div className="room-view">
          <h2>Room: {currentRoom.roomId}</h2>
          <div className="room-info">
            <div className="players-list">
              <h3>Players ({players.length}/2)</h3>
              {players.map((player, index) => (
                <div key={player.id} className="player-item">
                  <span className="player-name">{player.name}</span>
                  <span className="player-status">
                    {player.connected ? '🟢' : '🔴'}
                  </span>
                  {player.id === socketService.getCurrentPlayerId() && (
                    <span className="you-indicator">(You)</span>
                  )}
                </div>
              ))}
            </div>
            
            <div className="room-actions">
              <div className="room-status-info">
                <p className="room-status-message">{roomStatusMessage}</p>
                {canStartGame && (
                  <p className="ready-indicator">🎮 Ready to play!</p>
                )}
              </div>
              
              {statusMessage && (
                <p className="status-message">{statusMessage}</p>
              )}
              
              {canStartGame ? (
                <button 
                  className="start-game-button"
                  onClick={handleStartGame}
                  disabled={isLoading}
                >
                  {isLoading ? 'Starting...' : 'Start Game'}
                </button>
              ) : (
                <button 
                  className="start-game-button"
                  disabled={true}
                >
                  Need 2 Players
                </button>
              )}
              
              <button 
                className="leave-room-button"
                onClick={handleLeaveRoom}
                disabled={isLoading}
              >
                Leave Room
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="lobby-content">
        <div className="player-setup">
          <h3>Your Name</h3>
          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={20}
            disabled={isLoading}
            className="name-input"
          />
          {isLoadingNames && <div className="loading-hint">Generating name...</div>}
        </div>

        <div className="lobby-main">
          <div className="action-cards">
            <div className="action-card create-card">
              <div className="card-icon">+</div>
              <h3>Create New Room</h3>
              <p className="card-description">Start a new game and share the room code with a friend</p>
              <button 
                className="action-button create-button"
                onClick={handleCreateRoom}
                disabled={!playerName.trim() || isLoading}
              >
                {isLoading ? 'Creating...' : 'Create Room'}
              </button>
            </div>

            <div className="action-card join-card">
              <div className="card-icon">#</div>
              <h3>Join by Room ID</h3>
              <p className="card-description">Enter a room code to join an existing game</p>
              <input
                type="text"
                placeholder="ROOM ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                maxLength={6}
                disabled={isLoading}
                className="room-id-input"
              />
              <button 
                className="action-button join-button"
                onClick={handleJoinRoomById}
                disabled={!playerName.trim() || !roomId.trim() || isLoading}
              >
                {isLoading ? 'Joining...' : 'Join Room'}
              </button>
            </div>
          </div>

          <div className="divider">
            <span>OR</span>
          </div>

          <div className="available-rooms-section">
            <div className="section-header">
              <h3>Available Rooms</h3>
              <div className="refresh-indicator">
                {autoRefreshInterval && <span className="live-badge">🟢 Live</span>}
                {isRefreshing && <span className="refreshing-text">Refreshing...</span>}
              </div>
            </div>
            
            {availableRooms.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎮</div>
                <p>No available rooms</p>
                <p className="empty-hint">Create a new room or enter a room ID to start playing!</p>
              </div>
            ) : (
              <div className="rooms-grid">
                {availableRooms.map((room) => (
                  <div key={room.roomId} className="room-card">
                    <div className="room-card-header">
                      <span className="room-code">{room.roomId}</span>
                      <span className="player-count">
                        <span className="player-icon">👥</span>
                        {room.players.length}/2
                      </span>
                    </div>
                    <button 
                      className="join-room-button"
                      onClick={() => handleJoinRoom(room.roomId)}
                      disabled={!playerName.trim() || room.players.length >= 2 || isLoading}
                    >
                      {room.players.length >= 2 ? 'Full' : 'Join Room'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="multiplayer-lobby">
      <div className="lobby-header">
        <h1>Multiplayer Lobby</h1>
        {renderConnectionStatus()}
        <br/>
        <button 
          className="back-to-menu-button"
          onClick={() => {
            socketService.disconnect();
            onBackToMenu();
          }}
        >
          Back to Menu
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {renderLobbyContent()}
    </div>
  );
}
