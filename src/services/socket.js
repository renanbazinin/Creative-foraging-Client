import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.currentRoom = null;
    this.currentRoomId = null;
    this.currentPlayer = null;
    this.eventListeners = new Map();
  }

  connect(serverUrl = 'http://localhost:3001') {
    if (this.socket) {
      this.disconnect();
    }

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.setupEventListeners();
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.currentRoom = null;
    }
  }

  setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('[Client Socket] Connected to server:', this.socket.id);
      this.connected = true;
      this.emit('connection-status', { connected: true, id: this.socket.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Client Socket] Disconnected from server:', reason);
      this.connected = false;
      // Clear room state on disconnect to avoid stale state
      this.currentRoom = null;
      this.currentRoomId = null;
      this.currentPlayer = null;
      console.log('[Client Socket] Cleared room state due to disconnect');
      this.emit('connection-status', { connected: false, reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Client Socket] Connection error:', error);
      this.emit('connection-error', { error: error.message });
    });

    // Room events
    this.socket.on('room-created', (data) => {
      console.log('[Client Socket] Room created:', data);
      this.currentRoom = data.roomId;
      this.currentRoomId = data.roomId;
      this.emit('room-created', data);
    });

    this.socket.on('room-joined', (data) => {
      console.log('[Client Socket] Room joined:', data);
      this.currentRoom = data.roomId;
      this.currentRoomId = data.roomId;
      this.emit('room-joined', data);
    });

    this.socket.on('player-joined', (data) => {
      console.log('[Client Socket] Player joined room:', data);
      this.emit('player-joined', data);
    });

    this.socket.on('player-left', (data) => {
      console.log('[Client Socket] Player left room:', data);
      this.emit('player-left', data);
    });

    this.socket.on('room-left', (data) => {
      console.log('[Client Socket] Left room:', data);
      this.currentRoom = null;
      this.emit('room-left', data);
    });

    this.socket.on('available-rooms', (data) => {
      console.log('[Client Socket] Available rooms received:', data);
      this.emit('available-rooms', data);
    });

    this.socket.on('room-status-update', (data) => {
      console.log('[Client Socket] Room status update:', data);
      this.emit('room-status-update', data);
    });

    // Game events
    this.socket.on('game-state-update', (data) => {
      console.log('[Client Socket] Game state updated:', data);
      this.emit('game-state-update', data);
    });

    this.socket.on('move-locked', (data) => {
      console.log('[Client Socket] Game locked by player:', data);
      this.emit('move-locked', data);
    });

    this.socket.on('move-unlocked', (data) => {
      console.log('[Client Socket] Game unlocked:', data);
      this.emit('move-unlocked', data);
    });

    this.socket.on('move-accepted', (data) => {
      console.log('[Client Socket] Move accepted:', data);
      this.emit('move-accepted', data);
    });

    this.socket.on('move-rejected', (data) => {
      console.warn('[Client Socket] Move rejected:', data);
      this.emit('move-rejected', data);
    });

    this.socket.on('allowed-moves', (data) => {
      console.log('[Client Socket] Allowed moves received:', data);
      this.emit('allowed-moves', data);
    });

    // Lock management events
    this.socket.on('lock-acquired', (data) => {
      console.log('[Client Socket] Lock acquired:', data);
      this.emit('lock-acquired', data);
    });

    this.socket.on('lock-released', (data) => {
      console.log('[Client Socket] Lock released:', data);
      this.emit('lock-released', data);
    });

    this.socket.on('move-lock-granted', (data) => {
      console.log('[Client Socket] Move lock granted:', data);
      this.emit('move-lock-granted', data);
    });

    this.socket.on('move-lock-denied', (data) => {
      console.log('[Client Socket] Move lock denied:', data);
      this.emit('move-lock-denied', data);
    });

    this.socket.on('move-lock-released', (data) => {
      console.log('[Client Socket] Move lock released:', data);
      this.emit('move-lock-released', data);
    });

    this.socket.on('game-completed', (data) => {
      console.log('[Client Socket] Game completed:', data);
      this.emit('game-completed', data);
    });

    this.socket.on('game-reset', (data) => {
      console.log('[Client Socket] Game reset:', data);
      this.emit('game-reset', data);
    });

    this.socket.on('game-started', (data) => {
      console.log('[Client Socket] Game started:', data);
      this.emit('game-started', data);
    });

    this.socket.on('shape-saved', (data) => {
      console.log('Shape saved:', data);
      this.emit('shape-saved', data);
    });

    // Error handling
    this.socket.on('error', (data) => {
      console.error('Socket error:', data);
      this.emit('socket-error', data);
    });

    // Ping/Pong for connection health
    this.socket.on('pong', (data) => {
      this.emit('pong', data);
    });
  }

  // Event emitter functionality
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Room management
  createRoom(playerName) {
    console.log('[Client Socket] Creating room with player name:', playerName);
    if (!this.socket || !this.connected) {
      throw new Error('Not connected to server');
    }
    this.socket.emit('create-room', { playerName });
  }

  joinRoom(roomId, playerName) {
    console.log('[Client Socket] Joining room:', roomId, 'with player name:', playerName);
    if (!this.socket || !this.connected) {
      throw new Error('Not connected to server');
    }
    this.socket.emit('join-room', { roomId, playerName });
  }

  leaveRoom() {
    console.log('[Client Socket] Leaving room:', this.currentRoom);
    if (!this.socket || !this.connected || !this.currentRoom) {
      return;
    }
    this.socket.emit('leave-room', { roomId: this.currentRoom });
  }

  getAvailableRooms() {
    console.log('[Client Socket] Requesting available rooms');
    if (!this.socket || !this.connected) {
      throw new Error('Not connected to server');
    }
    this.socket.emit('get-available-rooms');
  }

  getRoomState() {
    if (!this.socket || !this.connected || !this.currentRoom) {
      throw new Error('Not connected to server or not in a room');
    }
    this.socket.emit('get-room-state', { roomId: this.currentRoom });
  }

  // Game actions
  attemptMove(fromIndex, toPosition) {
    if (!this.socket || !this.connected || !this.currentRoom) {
      throw new Error('Not connected to server or not in a room');
    }
    this.socket.emit('attempt-move', {
      roomId: this.currentRoom,
      fromIndex,
      toPosition
    });
  }

  // Make a move when you already have the lock
  makeLockedMove(fromIndex, toPosition) {
    if (!this.socket || !this.connected || !this.currentRoom) {
      throw new Error('Not connected to server or not in a room');
    }
    this.socket.emit('make-locked-move', {
      roomId: this.currentRoom,
      fromIndex,
      toPosition
    });
  }

  getAllowedMoves(tileIndex) {
    if (!this.socket || !this.connected || !this.currentRoom) {
      throw new Error('Not connected to server or not in a room');
    }
    this.socket.emit('get-allowed-moves', {
      roomId: this.currentRoom,
      tileIndex
    });
  }

  completeShape(finalGrid) {
    if (!this.socket || !this.connected || !this.currentRoom) {
      throw new Error('Not connected to server or not in a room');
    }
    this.socket.emit('complete-shape', {
      roomId: this.currentRoom,
      finalGrid
    });
  }

  saveShape(grid, shapeName = 'Untitled Shape') {
    if (!this.socket || !this.connected || !this.currentRoom) {
      throw new Error('Not connected to server or not in a room');
    }
    this.socket.emit('save-shape', {
      roomId: this.currentRoom,
      grid,
      name: shapeName
    });
  }

  startGame() {
    console.log('[Client Socket] Starting game:', {
      connected: this.connected,
      currentRoomId: this.currentRoomId,
      socketExists: !!this.socket
    });
    
    if (!this.socket || !this.connected || !this.currentRoomId) {
      throw new Error('Not connected to server or not in a room');
    }
    
    console.log('[Client Socket] Emitting start-game event for room:', this.currentRoomId);
    this.socket.emit('start-game', {
      roomId: this.currentRoomId
    });
  }

  getCurrentRoom() {
    return this.currentRoomId;
  }

  async checkRoomExists(roomId) {
    return new Promise((resolve) => {
      if (!this.socket || !this.connected) {
        resolve(false);
        return;
      }
      
      // Request available rooms and check if our room is in the list
      this.socket.emit('get-available-rooms');
      
      const timeout = setTimeout(() => {
        this.socket.off('available-rooms', checkResponse);
        resolve(false);
      }, 3000);
      
      const checkResponse = (data) => {
        clearTimeout(timeout);
        const roomExists = data.rooms.some(room => room.roomId === roomId);
        resolve(roomExists);
      };
      
      this.socket.once('available-rooms', checkResponse);
    });
  }

  resetGame() {
    if (!this.socket || !this.connected || !this.currentRoom) {
      throw new Error('Not connected to server or not in a room');
    }
    this.socket.emit('reset-game', {
      roomId: this.currentRoom
    });
  }

  // Lock management methods
  requestMove(tileIndex) {
    if (!this.socket || !this.connected || !this.currentRoom) {
      throw new Error('Not connected to server or not in a room');
    }
    this.socket.emit('request-move', {
      roomId: this.currentRoom,
      tileIndex
    });
  }

  releaseMove() {
    if (!this.socket || !this.connected || !this.currentRoom) {
      throw new Error('Not connected to server or not in a room');
    }
    this.socket.emit('release-move', {
      roomId: this.currentRoom
    });
  }

  // Utility methods
  isConnected() {
    return this.connected;
  }

  getCurrentRoom() {
    return this.currentRoom;
  }

  getCurrentPlayerId() {
    return this.socket ? this.socket.id : null;
  }

  ping() {
    if (this.socket && this.connected) {
      this.socket.emit('ping');
    }
  }
}

// Create singleton instance
const socketService = new SocketService();
export default socketService;
