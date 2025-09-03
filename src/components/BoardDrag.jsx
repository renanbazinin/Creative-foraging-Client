import React, { useState, useRef, useEffect, useCallback } from 'react';
import { allowedMoves } from '../utils/grid';
import socketService from '../services/socket';
import './Board.css';

// Constants for immediate drag response
const MIN_DRAG_DISTANCE = 3; // pixels - very small threshold just to distinguish from clicks

export default function BoardDrag({
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
  const isMultiplayer = gameMode === 'online';

  const centerY = Math.floor(gridSize / 2);
  const initialTiles = React.useMemo(() => Array.from({ length: 10 }).map((_, i) => ({ x: i, y: centerY })), [centerY]);

  const [tiles, setTiles] = useState(initialTiles);
  const [moveCount, setMoveCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [history, setHistory] = useState([initialTiles]);
  const [allowed, setAllowed] = useState([]);
  const [lockOwner, setLockOwner] = useState(null);
  const [isGameLocked, setIsGameLocked] = useState(false);
  const [currentPlayerId, setCurrentPlayerId] = useState(null);
  const [connectedPlayers, setConnectedPlayers] = useState([]);

  const [dragState, setDragState] = useState({
    index: null,
    isDragging: false,
    ghostPos: { x: 0, y: 0 },
    isPressed: false, // Track if pointer is down
  });

  // **NEW: State to manage the final "snap" animation**
  const [snapAnimation, setSnapAnimation] = useState({
    isSnapping: false,
    ghostPos: { x: 0, y: 0 }
  });

  const boardRef = useRef(null);
  const dragStartPos = useRef({ clientX: 0, clientY: 0 });
  const originTileRef = useRef(null);
  // **NEW: Refs to track current state for event handlers**
  const dragStateRef = useRef(dragState);
  const allowedRef = useRef(allowed);

  // Cleanup effect to prevent memory leaks and stuck event listeners
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  // Reset on setup/new game
  useEffect(() => {
    if (gameState === 'setup') {
      setTiles(initialTiles);
      setMoveCount(0);
      setStatusMessage('');
      setHistory([initialTiles]);
      setDragState({ index: null, isDragging: false, ghostPos: { x: 0, y: 0 }, isPressed: false });
      setAllowed([]);
      setIsGameLocked(false);
      setLockOwner(null);
    }
  }, [gameState, initialTiles]);

  // Debug: Monitor dragState changes
  useEffect(() => {
    dragStateRef.current = dragState; // Keep ref in sync
  }, [dragState]);

  // Keep allowed moves ref in sync
  useEffect(() => {
    allowedRef.current = allowed;
  }, [allowed]);

  // Multiplayer listeners (unchanged from previous version)
  useEffect(() => {
    if (!isMultiplayer || !multiplayerData) return;
    setCurrentPlayerId(socketService.getCurrentPlayerId());
    setConnectedPlayers(multiplayerData.players || []);

    const handleMoveLockGranted = (data) => {
      if (dragState.isDragging && data.tileIndex === dragState.index) {
        setAllowed(data.moves);
        setStatusMessage('Lock acquired. Drag to reposition.');
        setIsGameLocked(true);
        setLockOwner(currentPlayerId);
      }
    };
    const handleMoveLockDenied = (data) => {
      if (dragState.isDragging && data.tileIndex === dragState.index) {
        setStatusMessage('Lock denied.');
        setDragState({ index: null, isDragging: false, ghostPos: { x: 0, y: 0 } });
        setAllowed([]);
      }
    };

    const handleGameStateUpdate = (data) => {
      if (data.tiles) {
        setTiles(data.tiles);
        setMoveCount(data.moveCount || 0);
        setStatusMessage('Game state updated');
        setTimeout(() => setStatusMessage(''), 1500);
      }
    };

    const handleMoveAccepted = (data) => {
      if (data.tiles) {
        setTiles(data.tiles);
        setMoveCount(data.moveCount || 0);
        setStatusMessage('Move accepted');
        setTimeout(() => setStatusMessage(''), 1500);
      }
    };

    // ... other socket handlers
    socketService.on('move-lock-granted', handleMoveLockGranted);
    socketService.on('move-lock-denied', handleMoveLockDenied);
    socketService.on('game-state-update', handleGameStateUpdate);
    socketService.on('move-accepted', handleMoveAccepted);
    // ...
    return () => {
      socketService.off('move-lock-granted', handleMoveLockGranted);
      socketService.off('move-lock-denied', handleMoveLockDenied);
      socketService.off('game-state-update', handleGameStateUpdate);
      socketService.off('move-accepted', handleMoveAccepted);
      // ...
    };
  }, [isMultiplayer, multiplayerData, dragState.index, dragState.isDragging, currentPlayerId]);


  const idxAt = (col, row) => tiles.findIndex(t => t.x === col && t.y === row);
  
  // **NEW: Function to handle the end of the snap animation**
  const onSnapAnimationEnd = (finalMove) => {
      
      // This is where the actual state update happens.
      if (isMultiplayer) {
          if (isGameLocked && lockOwner === currentPlayerId) {
              try {
                  socketService.makeLockedMove(dragState.index, { x: finalMove.x, y: finalMove.y });
                  setStatusMessage('Submitting move...');
              } catch (err) {
                  setStatusMessage('Error: ' + err.message);
              }
          } else {
              setStatusMessage('Lost lock.');
          }
      } else {
          const newTiles = tiles.map((t, i) => i === dragState.index ? { x: finalMove.x, y: finalMove.y } : t);
          setTiles(newTiles);
          setMoveCount(c => c + 1);
          setHistory(h => [...h, newTiles]);
          setStatusMessage(`Moved to (${finalMove.x},${finalMove.y})`);
          setTimeout(() => setStatusMessage(''), 1500);
      }
      
      // Clean up all temporary states.
      setSnapAnimation({ isSnapping: false, ghostPos: { x: 0, y: 0 } });
      setDragState({ index: null, isDragging: false, ghostPos: { x: 0, y: 0 }, isPressed: false });
      setAllowed([]);
  };

  const handlePointerUp = (e) => {
    const currentDragState = dragStateRef.current;
    const currentAllowed = allowedRef.current;

    // IMMEDIATELY clean up event listeners and pressed state to prevent stuck drags
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    
    // FORCE clear the pressed state immediately to prevent stuck behavior
    setDragState(prev => ({ ...prev, isPressed: false }));

    // If no drag happened, just reset everything
    if (!currentDragState.isDragging) {
      setDragState({ index: null, isDragging: false, ghostPos: { x: 0, y: 0 }, isPressed: false });
      setAllowed([]);
      return;
    }

    if (currentAllowed.length === 0) {
      setStatusMessage('No valid moves available');
      setDragState({ index: null, isDragging: false, ghostPos: { x: 0, y: 0 }, isPressed: false });
      setAllowed([]);
      return;
    }

    const rect = boardRef.current.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;


    const nearest = currentAllowed.reduce((best, move) => {
      const moveCenterX = move.x * cellSize + cellSize / 2;
      const moveCenterY = (gridSize - 1 - move.y) * cellSize + cellSize / 2;
      const distSq = Math.pow(pointerX - moveCenterX, 2) + Math.pow(pointerY - moveCenterY, 2);
      
      if (!best || distSq < best.distSq) return { move, distSq };
      return best;
    }, null);

    if (nearest) {
      const { move } = nearest;
      
      const finalPixelPos = {
          x: move.x * cellSize + cellSize / 2,
          y: (gridSize - 1 - move.y) * cellSize + cellSize / 2,
      };

      
      setSnapAnimation({
          isSnapping: true,
          ghostPos: finalPixelPos,
          finalMove: move,
      });
      setDragState(prev => ({ ...prev, isDragging: false, isPressed: false }));

    } else {
       setDragState({ index: null, isDragging: false, ghostPos: { x: 0, y: 0 }, isPressed: false });
       setAllowed([]);
    }
  };


  const handlePointerMove = (e) => {
    // Prevent browser's default drag behavior
    e.preventDefault();
    e.stopPropagation();
    
    const currentDragState = dragStateRef.current;

    
    if (currentDragState.index === null || !currentDragState.isPressed) {
      return;
    }
    
    // Calculate movement distance from start
    const dx = e.clientX - dragStartPos.current.clientX;
    const dy = e.clientY - dragStartPos.current.clientY;
    const distance = Math.hypot(dx, dy);
    
    // Start dragging immediately when minimum distance is reached
    if (!currentDragState.isDragging && distance > MIN_DRAG_DISTANCE) {
      
      // Calculate allowed moves immediately
      if (!isMultiplayer) {
        const moves = allowedMoves(tiles, currentDragState.index);
        
        if (moves.length === 0) {
          setStatusMessage('Block cannot be moved');
          setTimeout(() => setStatusMessage(''), 1500);
          setDragState({ index: null, isDragging: false, ghostPos: { x: 0, y: 0 }, isPressed: false });
          setAllowed([]);
          // IMPORTANT: Remove event listeners to prevent stuck state
          window.removeEventListener('pointermove', handlePointerMove);
          window.removeEventListener('pointerup', handlePointerUp);
          return;
        }
        
        setAllowed(moves);
      }
      
      // Activate drag immediately - but only if we have valid moves or it's multiplayer
      if (!isMultiplayer && allowedRef.current.length === 0) {
        return;
      }
      
      setDragState(prev => ({ ...prev, isDragging: true }));
      setStatusMessage('Drag to reposition block');
      
      if (isMultiplayer) {
        socketService.requestMove(currentDragState.index);
      }
    }
    
    // Update ghost position continuously during drag OR when we're about to start dragging
    if (currentDragState.isDragging || (distance > MIN_DRAG_DISTANCE && allowedRef.current.length > 0)) {
      const rect = boardRef.current.getBoundingClientRect();
      const newGhostPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      
      
      setDragState(prev => ({
        ...prev,
        ghostPos: newGhostPos,
        isDragging: distance > MIN_DRAG_DISTANCE ? true : prev.isDragging
      }));
    }
  };


  const handlePointerDown = (e) => {
    // CRITICAL: Prevent browser's default drag behavior
    e.preventDefault();
    e.stopPropagation();
    

    
    if (!isGameActive || gameState !== 'playing' || dragState.index !== null) {
      return;
    }

    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / cellSize);
    const row = gridSize - 1 - Math.floor(y / cellSize);
    const index = idxAt(col, row);


    if (index === -1) {
      return;
    }
    
    if (isMultiplayer && isGameLocked && lockOwner !== currentPlayerId) {
      setStatusMessage('Other player is moving...');
      return;
    }
    
    
    // Set initial state with isPressed = true, ready for immediate drag
    setDragState({ 
      index, 
      isDragging: false, 
      ghostPos: { x, y },
      isPressed: true 
    });
    
    dragStartPos.current = { clientX: e.clientX, clientY: e.clientY };
    originTileRef.current = { ...tiles[index] };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp, { passive: false });
  };
  
  // Omitted for brevity: renderPlayerStatus, handleCompleteShape, etc. they remain the same.
  // ...

  const renderGhostTile = () => {

    
    let ghostStyle = {
      width: cellSize - tileMargin * 2,
      height: cellSize - tileMargin * 2,
      position: 'absolute',
      left: 0,
      top: 0,
      background: '#0f0',
      borderRadius: 4,
      zIndex: 1000,
      pointerEvents: 'none',
      opacity: 0,
    };

    if (dragState.isDragging && dragState.isPressed) {
      ghostStyle.opacity = 0.85;
      ghostStyle.transform = `translate(${dragState.ghostPos.x - cellSize / 2}px, ${dragState.ghostPos.y - cellSize / 2}px)`;
      ghostStyle.transition = 'none';
    } else if (snapAnimation.isSnapping) {
      ghostStyle.opacity = 0.85;
      ghostStyle.transform = `translate(${snapAnimation.ghostPos.x - cellSize / 2}px, ${snapAnimation.ghostPos.y - cellSize / 2}px)`;
      ghostStyle.transition = 'transform 0.2s ease-out'; // The smooth animation!
    } else if (dragState.isDragging && !dragState.isPressed) {
      // Safety: if we're somehow still dragging but not pressed, hide the ghost
      ghostStyle.opacity = 0;
    }

    return (
       <div 
        style={ghostStyle} 
        onTransitionEnd={() => {
          if (snapAnimation.isSnapping && snapAnimation.finalMove) {
            onSnapAnimationEnd(snapAnimation.finalMove);
          }
        }} 
       />
    );
  };

  return (
    <div className="board-container">
      {/* renderPlayerStatus() */}
      <div ref={boardRef} className="grid" style={{ 
        position: 'relative', 
        width: gridSize * cellSize, 
        height: gridSize * cellSize, 
        border: '2px solid #0f0', 
        background: '#000',
        // Prevent browser drag behavior
        userSelect: 'none',
        WebkitUserDrag: 'none',
        touchAction: 'none',
      }} onPointerDown={handlePointerDown}>
        {tiles.map((tile, tileIdx) => {
          let opacity = 1;
          // Hide the original tile while it's being dragged or animating.
          if ((dragState.isDragging || snapAnimation.isSnapping) && dragState.index === tileIdx) {
            opacity = 0.2;
          }
          return (
            <div key={`${tile.x}-${tile.y}-${tileIdx}`} style={{
                width: cellSize - tileMargin * 2,
                height: cellSize - tileMargin * 2,
                position: 'absolute',
                left: tile.x * cellSize + tileMargin,
                top: (gridSize - 1 - tile.y) * cellSize + tileMargin,
                background: '#0f0',
                borderRadius: 4,
                opacity: opacity,
                transition: 'opacity 0.2s',
                // Prevent browser drag behavior
                userSelect: 'none',
                WebkitUserDrag: 'none',
                pointerEvents: 'auto',
                touchAction: 'none',
              }} />
          )
        })}
        {/* Render valid move indicators */}
        {allowed.map((move, i) => (
           <div key={`move-${i}`} style={{
                /* styles for allowed moves */
            }} />
        ))}
        {/* **NEW: Render the ghost tile, which handles dragging AND snapping.** */}
        {renderGhostTile()}
      </div>
      <div className="status-bar">
        {statusMessage ? <p>{statusMessage}</p> : <p>{dragState.isDragging ? 'Release to drop' : 'Hold a block to move it'}</p>}
      </div>
    </div>
  );
}