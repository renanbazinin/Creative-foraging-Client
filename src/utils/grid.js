// Grid utility functions for Creative Foraging game

/**
 * Check if a set of positions (with {x,y}) is 4-connected.
 */
export function isContiguous(positions) {
  const items = new Set(positions.map(p => `${p.x},${p.y}`));
  if (items.size === 0) return true;
  // 4-directional (orthogonal) connectivity
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  const [start] = positions;
  const fringe = [start];
  const visited = new Set();

  while (fringe.length) {
    const { x, y } = fringe.pop();
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    for (let [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      const nkey = `${nx},${ny}`;
      if (items.has(nkey) && !visited.has(nkey)) {
        fringe.push({ x: nx, y: ny });
      }
    }
  }

  return visited.size === items.size;
}

/**
 * For a given tile index, return all valid adjacent moves based on perimeter cells.
 * Matches Python allowed_pos: neighbors of all other tiles, excluding duplicates and occupied.
 */
export function allowedMoves(allPos, targetIndex) {
  // First, check if removing the tile would break contiguity.
  const remaining = allPos.filter((_, i) => i !== targetIndex);
  if (!isContiguous(remaining)) {
    return []; // This move would break the shape.
  }

  const gridLimit = 10;
  const deltas = [[1,0],[-1,0],[0,1],[0,-1]];
  // occupied coordinates
  const occupied = new Set(allPos.map(p => `${p.x},${p.y}`));
  // collect neighbor positions of all other tiles (the remaining shape)
  const candidate = new Set();
  remaining.forEach((p) => {
    deltas.forEach(([dx, dy]) => {
      const nx = p.x + dx;
      const ny = p.y + dy;
      if (nx >= 0 && ny >= 0 && nx < gridLimit && ny < gridLimit) {
        candidate.add(`${nx},${ny}`);
      }
    });
  });
  // filter out occupied
  return Array.from(candidate)
    .filter(key => !occupied.has(key))
    .map(key => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    });
}

/**
 * Legacy function for backward compatibility - same as isContiguous
 */
export function isConnected(tiles) {
  return isContiguous(tiles);
}

/**
 * Check if a tile is on the edge of the connected shape (can be moved)
 */
export function isEdgeTile(tiles, tileIndex) {
  if (tiles.length <= 1) return true;
  
  const otherTiles = tiles.filter((_, i) => i !== tileIndex);
  
  return isContiguous(otherTiles);
}
