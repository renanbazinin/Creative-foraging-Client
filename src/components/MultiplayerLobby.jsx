import React, { useState, useEffect } from 'react';
import socketService from '../services/socket';
import './MultiplayerLobby.css';

export default function MultiplayerLobby({ onGameStart, onBackToMenu }) {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [availableRooms, setAvailableRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [canStartGame, setCanStartGame] = useState(false);
  const [roomStatusMessage, setRoomStatusMessage] = useState('');

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
    socketService.on('socket-error', handleSocketError);
    socketService.on('game-state-update', handleGameStateUpdate);
    socketService.on('game-started', handleGameStarted);
    socketService.on('room-status-update', handleRoomStatusUpdate);

    // Cleanup function
    return () => {
      socketService.off('connection-status', handleConnectionStatus);
      socketService.off('connection-error', handleConnectionError);
      socketService.off('room-created', handleRoomCreated);
      socketService.off('room-joined', handleRoomJoined);
      socketService.off('player-joined', handlePlayerJoined);
      socketService.off('player-left', handlePlayerLeft);
      socketService.off('room-left', handleRoomLeft);
      socketService.off('available-rooms', handleAvailableRooms);
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

  const handleStartGame = () => {
    console.log('[Client Lobby] Start game button clicked');
    console.log('  - Current room:', currentRoom?.roomId);
    console.log('  - Players count:', players.length);
    console.log('  - Can start game:', canStartGame);
    
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
          <h3>Enter Your Name</h3>
          <input
            type="text"
            placeholder="Your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={20}
            disabled={isLoading}
          />
        </div>

        <div className="room-actions">
          <div className="create-room-section">
            <h3>Create New Room</h3>
            <button 
              className="create-room-button"
              onClick={handleCreateRoom}
              disabled={!playerName.trim() || isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Room'}
            </button>
          </div>

          <div className="join-room-section">
            <h3>Join Room by ID</h3>
            <div className="join-by-id">
              <input
                type="text"
                placeholder="Room ID"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                maxLength={6}
                disabled={isLoading}
              />
              <button 
                className="join-room-button"
                onClick={handleJoinRoomById}
                disabled={!playerName.trim() || !roomId.trim() || isLoading}
              >
                {isLoading ? 'Joining...' : 'Join'}
              </button>
            </div>
          </div>

          <div className="available-rooms-section">
            <h3>Available Rooms</h3>
            {availableRooms.length === 0 ? (
              <p className="no-rooms">No rooms available</p>
            ) : (
              <div className="rooms-list">
                {availableRooms.map((room) => (
                  <div key={room.roomId} className="room-item">
                    <div className="room-details">
                      <span className="room-id">{room.roomId}</span>
                      <span className="room-players">
                        {room.players.length}/2 players
                      </span>
                    </div>
                    <button 
                      className="join-room-button"
                      onClick={() => handleJoinRoom(room.roomId)}
                      disabled={!playerName.trim() || room.players.length >= 2 || isLoading}
                    >
                      Join
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
