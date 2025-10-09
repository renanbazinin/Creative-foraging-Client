import React, { useState, useRef, useEffect, useCallback } from 'react';
import SummaryPanel from './SummaryPanel';
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
  const [summary, setSummary] = useState(null);

  const [dragState, setDragState] = useState({
    index: null,
    isDragging: false,
    ghostPos: { x: 0, y: 0 },
    isPressed: false, // Track if pointer is down
  });

  // Opponent drag preview state
  const [opponentDrag, setOpponentDrag] = useState({
    active: false,
    tileIndex: null,
    ghostPos: { x: 0, y: 0 }, // pixel center of lifted tile
    lastUpdate: 0,
    phase: 'idle', // idle | dragging | released | animatingToCell
    handVisible: false
  });
  const opponentFinishTimeoutRef = useRef(null);
  const previousTilesRef = useRef(tiles);
  const releasedTileRef = useRef(null); // Track which tile was just released

  useEffect(() => { previousTilesRef.current = tiles; }, [tiles]);

  // **NEW: State to manage the final "snap" animation**
  const [snapAnimation, setSnapAnimation] = useState({
    isSnapping: false,
    ghostPos: { x: 0, y: 0 }
  });

  // Opponent snap animation state - same system as main player
  const [opponentSnapAnimation, setOpponentSnapAnimation] = useState({
    isSnapping: false,
    ghostPos: { x: 0, y: 0 },
    tileIndex: null
  });

  const boardRef = useRef(null);
  const dragStartPos = useRef({ clientX: 0, clientY: 0 });
  const originTileRef = useRef(null);
  // **NEW: Refs to track current state for event handlers**
  const dragStateRef = useRef(dragState);
  const allowedRef = useRef(allowed);
  // Track optimistic moves to prevent server overwrites
  const optimisticMoveRef = useRef(null);

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
      optimisticMoveRef.current = null; // Clear any pending optimistic moves
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
        const prevTiles = previousTilesRef.current;
        
        // Check if this update matches our optimistic move
        if (optimisticMoveRef.current) {
          const opt = optimisticMoveRef.current;
          const serverPos = data.tiles[opt.tileIndex];
          
          // If server confirms our optimistic move, just clear the ref
          if (serverPos && serverPos.x === opt.newPos.x && serverPos.y === opt.newPos.y) {
            optimisticMoveRef.current = null;
            setMoveCount(data.moveCount || 0);
            return; // Don't update tiles - we already have it
          } else {
            // Server rejected or has different state - clear and apply server state
            optimisticMoveRef.current = null;
          }
        }
        
        setTiles(data.tiles);
        setMoveCount(data.moveCount || 0);
        setStatusMessage('Game state updated');
        setTimeout(() => setStatusMessage(''), 1500);
        
        // Opponent drop animation trigger: if we saw release, start snap animation like main player
        if (releasedTileRef.current != null) {
          const idx = releasedTileRef.current;
          if (prevTiles[idx] && data.tiles[idx]) {
            const prevPos = prevTiles[idx];
            const newPos = data.tiles[idx];
            if (prevPos.x !== newPos.x || prevPos.y !== newPos.y) {
              // Calculate final pixel position for snap animation
              const finalPixelPos = {
                x: newPos.x * cellSize + cellSize / 2,
                y: (gridSize - 1 - newPos.y) * cellSize + cellSize / 2
              };
              
              // Clear released tile ref
              releasedTileRef.current = null;
              
              // Start opponent snap animation using same system as main player
              setOpponentSnapAnimation({
                isSnapping: true,
                ghostPos: finalPixelPos,
                tileIndex: idx
              });
            }
          }
        }
      }
    };

    const handleMoveAccepted = (data) => {
      if (data.tiles) {
        // Check if this matches our optimistic move
        if (optimisticMoveRef.current) {
          const opt = optimisticMoveRef.current;
          const serverPos = data.tiles[opt.tileIndex];
          
          // Server confirmed our move - just clear the ref and update move count
          if (serverPos && serverPos.x === opt.newPos.x && serverPos.y === opt.newPos.y) {
            optimisticMoveRef.current = null;
            setMoveCount(data.moveCount || 0);
            return; // Don't update tiles - we already applied optimistically
          } else {
            // Server has different state - clear and apply
            optimisticMoveRef.current = null;
          }
        }
        
        setTiles(data.tiles);
        setMoveCount(data.moveCount || 0);
        setStatusMessage('Move accepted');
        setTimeout(() => setStatusMessage(''), 1500);
      }
    };

    const handleGameEnded = (data) => {
      setStatusMessage('Game ended');
    };
    const handleGameSummary = (data) => {
      setSummary(data.summary);
      // Save to localStorage with simple id
      let savedGames = [];
      try {
        savedGames = JSON.parse(localStorage.getItem('foraging-game-summaries')) || [];
      } catch {}
      // Prevent duplicate save: check if already present by roomId
      const alreadyExists = savedGames.some(g => g.roomId === data.summary.roomId);
      if (!alreadyExists) {
        const id = savedGames.length;
        const summaryWithId = { ...data.summary, id };
        localStorage.setItem('foraging-game-summaries', JSON.stringify([summaryWithId, ...savedGames]));
        console.log('[BoardDrag] Saved multiplayer game summary to localStorage:', summaryWithId);
      } else {
        console.log('[BoardDrag] Game summary already saved for roomId, skipping duplicate.');
      }
    };

    // Live opponent drag handlers
    const handleOpponentDrag = (data) => {
      if (!boardRef.current) return;
      if (data.playerId === socketService.getCurrentPlayerId()) return;
      console.log('[DEBUG] Opponent drag start:', data);
      // Convert normalized back to pixels
      const rect = boardRef.current.getBoundingClientRect();
      const px = data.pointer.x * rect.width;
      const py = data.pointer.y * rect.height;
      const newState = {
        active: true,
        tileIndex: data.tileIndex,
        ghostPos: { x: px, y: py },
        lastUpdate: Date.now(),
        phase: 'dragging',
        handVisible: true,
        targetCenter: null
      };
      console.log('[DEBUG] Setting opponent drag state:', newState);
      setOpponentDrag(newState);
    };
    const handleOpponentDragEnd = (data) => {
      if (data.playerId === socketService.getCurrentPlayerId()) return;
      console.log('[DEBUG] Opponent drag end received:', data);
      console.log('[DEBUG] Current opponent drag state before end:', opponentDrag);
      
      // Store released tile index for game-state-update detection
      releasedTileRef.current = opponentDrag.tileIndex;
      
      // Immediately hide hand and active state
      setOpponentDrag({
        active: false,
        tileIndex: null,
        ghostPos: { x: 0, y: 0 },
        lastUpdate: 0,
        phase: 'idle',
        handVisible: false
      });
      
      if (opponentFinishTimeoutRef.current) clearTimeout(opponentFinishTimeoutRef.current);
      // Fallback cleanup
      opponentFinishTimeoutRef.current = setTimeout(() => {
        console.log('[DEBUG] Fallback cleanup triggered');
        releasedTileRef.current = null;
      }, 700);
    };

    const handleLockReleased = (data) => {
      // Whenever lock releases and it's not us, ensure opponent visuals cleared
      if (data && data.playerId !== socketService.getCurrentPlayerId()) {
        releasedTileRef.current = null;
        setOpponentDrag({ active: false, tileIndex: null, ghostPos: { x:0,y:0 }, lastUpdate:0, phase:'idle', handVisible:false });
        setOpponentSnapAnimation({ isSnapping: false, ghostPos: { x:0,y:0 }, tileIndex: null });
      }
    };

    // ... other socket handlers
    socketService.on('move-lock-granted', handleMoveLockGranted);
    socketService.on('move-lock-denied', handleMoveLockDenied);
    socketService.on('game-state-update', handleGameStateUpdate);
    socketService.on('move-accepted', handleMoveAccepted);
  socketService.on('game-ended', handleGameEnded);
  socketService.on('game-summary', handleGameSummary);
    socketService.on('opponent-drag', handleOpponentDrag);
    socketService.on('opponent-drag-end', handleOpponentDragEnd);
    socketService.on('lock-released', handleLockReleased);
    // ...
    return () => {
      socketService.off('move-lock-granted', handleMoveLockGranted);
      socketService.off('move-lock-denied', handleMoveLockDenied);
      socketService.off('game-state-update', handleGameStateUpdate);
      socketService.off('move-accepted', handleMoveAccepted);
  socketService.off('game-ended', handleGameEnded);
  socketService.off('game-summary', handleGameSummary);
      socketService.off('opponent-drag', handleOpponentDrag);
      socketService.off('opponent-drag-end', handleOpponentDragEnd);
      socketService.off('lock-released', handleLockReleased);
      // ...
    };
  }, [isMultiplayer, multiplayerData, dragState.index, dragState.isDragging, currentPlayerId]);


  const idxAt = (col, row) => tiles.findIndex(t => t.x === col && t.y === row);
  
  // **NEW: Function to handle the end of the snap animation**
  const onSnapAnimationEnd = (finalMove) => {
      
      // OPTIMISTIC UPDATE: Apply move immediately to local state
      const newTiles = tiles.map((t, i) => i === dragState.index ? { x: finalMove.x, y: finalMove.y } : t);
      setTiles(newTiles);
      setMoveCount(c => c + 1);
      setHistory(h => [...h, newTiles]);
      
      // Clean up snap animation immediately
      setSnapAnimation({ isSnapping: false, ghostPos: { x: 0, y: 0 } });
      setDragState({ index: null, isDragging: false, ghostPos: { x: 0, y: 0 }, isPressed: false });
      setAllowed([]);
      
      // Submit to server in background (multiplayer only)
      if (isMultiplayer) {
          if (isGameLocked && lockOwner === currentPlayerId) {
              // Mark this as optimistic move to prevent server overwrite
              optimisticMoveRef.current = {
                tileIndex: dragState.index,
                newPos: { x: finalMove.x, y: finalMove.y },
                timestamp: Date.now()
              };
              
              try {
                  socketService.makeLockedMove(dragState.index, { x: finalMove.x, y: finalMove.y });
                  setStatusMessage(`Moved to (${finalMove.x},${finalMove.y})`);
                  setTimeout(() => setStatusMessage(''), 1500);
              } catch (err) {
                  // Revert on error
                  optimisticMoveRef.current = null;
                  setStatusMessage('Move failed: ' + err.message);
                  const revertTiles = tiles.map((t, i) => i === dragState.index ? tiles[dragState.index] : t);
                  setTiles(revertTiles);
                  setMoveCount(c => c - 1);
              }
          } else {
              setStatusMessage('Lost lock.');
              // Revert if no lock
              setTiles(tiles);
              setMoveCount(c => c - 1);
          }
      } else {
          setStatusMessage(`Moved to (${finalMove.x},${finalMove.y})`);
          setTimeout(() => setStatusMessage(''), 1500);
      }
  };

  // Opponent snap animation end handler
  const onOpponentSnapAnimationEnd = () => {
    setOpponentSnapAnimation({ isSnapping: false, ghostPos: { x: 0, y: 0 }, tileIndex: null });
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
      // End streaming if we had started
      if (isMultiplayer && currentDragState.index != null) {
        emitDragEnd(currentDragState.index);
      }
      return;
    }

    if (currentAllowed.length === 0) {
      setStatusMessage('No valid moves available');
      setDragState({ index: null, isDragging: false, ghostPos: { x: 0, y: 0 }, isPressed: false });
      setAllowed([]);
      if (isMultiplayer && currentDragState.index != null) {
        emitDragEnd(currentDragState.index);
      }
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
       if (isMultiplayer && currentDragState.index != null) {
         emitDragEnd(currentDragState.index);
       }
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

      // Stream normalized coordinates to opponent (throttle via rAF style: simple time check)
      if (isMultiplayer && dragStateRef.current.isDragging) {
        const now = Date.now();
        if (!handlePointerMove.lastSent || now - handlePointerMove.lastSent > 50) { // 20fps cap
          const norm = {
            x: newGhostPos.x / rect.width,
            y: newGhostPos.y / rect.height
          };
            socketService.sendDragUpdate(dragStateRef.current.index, norm);
            handlePointerMove.lastSent = now;
        }
      }
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

  // Emit end drag update (cosmetic)
  const emitDragEnd = (tileIndex) => {
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const gs = dragStateRef.current.ghostPos;
    const norm = { x: gs.x / rect.width, y: gs.y / rect.height };
    socketService.sendDragEnd(tileIndex, norm);
  };
  
  // Omitted for brevity: renderPlayerStatus, handleCompleteShape, etc. they remain the same.
  // ...

  // Save current shape to gallery (available while playing)
  const handleSaveCurrentShape = () => {
    // Build 10x10 grid from current tiles state
    const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
    tiles.forEach(({ x, y }) => {
      if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
        grid[gridSize - 1 - y][x] = 1;
      }
    });
    // Only save shape to server if multiplayer, but DO NOT add to gallery
    if (isMultiplayer) {
      try { socketService.saveShape(grid, 'Shape'); } catch {}
    }
    setStatusMessage('Shape saved');
    setTimeout(() => setStatusMessage(''), 2500);
  };

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
      ghostStyle.opacity = 1.0; // Full opacity for snap animation
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

  // Render opponent snap animation ghost (same style as main player)
  const renderOpponentSnapGhost = () => {
    if (!opponentSnapAnimation.isSnapping) return null;

    const ghostStyle = {
      width: cellSize - tileMargin * 2,
      height: cellSize - tileMargin * 2,
      position: 'absolute',
      left: 0,
      top: 0,
      background: '#0f0',
      borderRadius: 4,
      zIndex: 1000,
      pointerEvents: 'none',
      opacity: 1.0, // Full opacity for snap animation
      transform: `translate(${opponentSnapAnimation.ghostPos.x - cellSize / 2}px, ${opponentSnapAnimation.ghostPos.y - cellSize / 2}px)`,
      transition: 'transform 0.2s ease-out'
    };

    return (
      <div 
        style={ghostStyle} 
        onTransitionEnd={onOpponentSnapAnimationEnd}
      />
    );
  };

  // Opponent ghost (purple outline) only when active
  const renderOpponentGhost = () => {
    console.log('[DEBUG] renderOpponentGhost called - isMultiplayer:', isMultiplayer, 'opponentDrag.active:', opponentDrag.active, 'handVisible:', opponentDrag.handVisible);
    if (!isMultiplayer || !opponentDrag.active) return null;

    const baseSize = cellSize - tileMargin * 2;
    const left = opponentDrag.ghostPos.x - cellSize / 2;
    const top = opponentDrag.ghostPos.y - cellSize / 2;

    const isAnimating = opponentDrag.phase === 'animatingToCell';
    const style = {
      width: baseSize,
      height: baseSize,
      position: 'absolute',
      left: 0,
      top: 0,
      transform: `translate(${left}px, ${top}px)`,
      transition: isAnimating ? 'transform 200ms ease-out' : 'transform 40ms linear',
      background: 'rgba(0,255,0,0.35)',
      border: '2px solid #0f0',
      borderRadius: 4,
      pointerEvents: 'none',
      zIndex: 950,
      boxShadow: opponentDrag.phase === 'dragging' ? '0 0 10px rgba(0,255,120,0.7)' : '0 0 5px rgba(0,255,120,0.4)',
      backdropFilter: 'blur(1px)'
    };

    console.log('[DEBUG] Hand should be visible:', opponentDrag.handVisible);
    const hand = opponentDrag.handVisible ? (
      <img
        src="https://i.imgur.com/jf4ESYt.png"
        alt="hand"
        style={{
          position: 'absolute',
          left: left + baseSize * 0.1,
            top: top - baseSize * 0.4,
          width: baseSize * 1.5,
          height: 'auto',
          transform: 'rotate(8deg)',
          zIndex: 960,
          pointerEvents: 'none',
          filter: 'drop-shadow(0 0 6px rgba(0,255,120,0.5))'
        }}
      />
    ) : null;

    return (
      <>
        {hand}
        <div
          style={style}
          onTransitionEnd={() => {
            if (opponentDrag.phase === 'animatingToCell') {
              // Animation finished; remove overlay
              setOpponentDrag({ active: false, tileIndex: null, ghostPos: { x:0,y:0 }, lastUpdate:0, phase:'idle', handVisible:false });
            }
          }}
        />
      </>
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
          if (((dragState.isDragging || snapAnimation.isSnapping) && dragState.index === tileIdx) ||
              (opponentDrag.active && opponentDrag.tileIndex === tileIdx) ||
              (opponentSnapAnimation.isSnapping && opponentSnapAnimation.tileIndex === tileIdx)) {
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
                transition: 'left 0.18s ease-out, top 0.18s ease-out, opacity 0.15s',
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
        {renderOpponentSnapGhost()}
        {renderOpponentGhost()}
      </div>
      <div className="status-bar">
        {statusMessage ? <p>{statusMessage}</p> : <p>{dragState.isDragging ? 'Release to drop' : 'Hold a block to move it'}</p>}
        {gameState === 'playing' && (
          <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 }}>
            <button
              className="save-shape-button"
              style={{
                background: '#0f0',
                color: '#111',
                fontWeight: 'bold',
                border: 'none',
                borderRadius: 6,
                padding: '10px 24px',
                fontSize: '1.1em',
                boxShadow: '0 2px 8px #0f08',
                cursor: moveCount === 0 ? 'not-allowed' : 'pointer',
                opacity: moveCount === 0 ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
              onClick={handleSaveCurrentShape}
              disabled={moveCount === 0}
            >
              Save Shape to Gallery
            </button>
            <button
              className="end-game-button"
              style={{
                background: 'linear-gradient(90deg,#0f0 60%,#222 100%)',
                color: '#111',
                fontWeight: 'bold',
                border: '2px solid #0f0',
                borderRadius: 6,
                padding: '10px 24px',
                fontSize: '1.1em',
                boxShadow: '0 2px 12px #0f08',
                cursor: moveCount === 0 ? 'not-allowed' : 'pointer',
                opacity: moveCount === 0 ? 0.5 : 1,
                marginLeft: 0,
                transition: 'all 0.2s',
              }}
              onClick={() => {
                if (isMultiplayer) {
                  try { socketService.endGame(); } catch (e) { setStatusMessage(e.message); }
                } else {
                  setStatusMessage('Game ended');
                  // Build steps for summary
                  const steps = history.map((tilesAtStep, i) => {
                    const grid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
                    tilesAtStep.forEach(({ x, y }) => {
                      if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
                        grid[gridSize - 1 - y][x] = 1;
                      }
                    });
                    return { grid, user: `Player ${currentPlayer}` };
                  });
                  const newSummary = {
                    roomId: 'offline',
                    totalMoves: moveCount,
                    totalSaves: 0,
                    steps,
                    saves: []
                  };
                  setSummary(newSummary);
                  // Save to localStorage with simple id
                  let savedGames = [];
                  try {
                    savedGames = JSON.parse(localStorage.getItem('foraging-game-summaries')) || [];
                  } catch {}
                  const id = savedGames.length;
                  const summaryWithId = { ...newSummary, id };
                  localStorage.setItem('foraging-game-summaries', JSON.stringify([summaryWithId, ...savedGames]));
                  console.debug('[BoardDrag] Saved game summary to localStorage:', summaryWithId);
                }
              }}
              disabled={moveCount === 0}
            >
              End Game
            </button>
          </div>
        )}
      </div>
      {summary && (
        <SummaryPanel summary={summary} players={connectedPlayers} />
      )}
    </div>
  );
}