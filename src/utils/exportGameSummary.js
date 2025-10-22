/**
 * Utility functions to export game summary data in various formats
 */

/**
 * Convert game summary to CSV format
 * @param {Object} summary - Game summary object
 * @param {Array} players - Array of player objects with id and name
 * @returns {string} CSV formatted string
 */
export function convertSummaryToCSV(summary, players = []) {
  if (!summary) return '';

  // Create player name lookup
  const idToName = {};
  players.forEach(p => {
    idToName[p.id] = p.name;
  });

  const getName = (id) => {
    if (!id) return 'Unknown';
    return idToName[id] || id || 'Unknown';
  };

  // Build saved steps lookup
  const savedSteps = {};
  (summary.saves || []).forEach(s => {
    const idx = Number(s.step);
    if (!Number.isFinite(idx)) return;
    if (!savedSteps[idx]) savedSteps[idx] = new Set();
    savedSteps[idx].add(s.user);
  });

  // CSV Header
  let csv = 'Game Summary\n';
  csv += `Room ID,${escapeCSV(summary.roomId)}\n`;
  csv += `Total Moves,${summary.totalMoves}\n`;
  csv += `Total Saves,${summary.saves?.length || 0}\n`;
  csv += `Timestamp,${new Date(summary.timestamp).toLocaleString()}\n`;
  csv += '\n';

  // Player Stats (if available)
  if (summary.perUser && Object.keys(summary.perUser).length > 0) {
    csv += 'Player Statistics\n';
    csv += 'Player Name,Moves,Saves\n';
    Object.entries(summary.perUser).forEach(([userId, stats]) => {
      csv += `${escapeCSV(getName(userId))},${stats.moves || 0},${stats.saves || 0}\n`;
    });
    csv += '\n';
  }

  // Steps Table
  csv += 'Step-by-Step Details\n';
  csv += 'Step,Player,Grid State,Saved By\n';
  
  (summary.steps || []).forEach((step, i) => {
    const savers = savedSteps[i] ? Array.from(savedSteps[i]).map(id => getName(id)) : [];
    const gridState = step.grid ? serializeGrid(step.grid) : '';
    const stepNum = i === 0 ? '0 (init)' : i;
    const playerName = getName(step.user);
    const savedBy = savers.length ? savers.join('; ') : '';
    
    csv += `${stepNum},${escapeCSV(playerName)},${escapeCSV(gridState)},${escapeCSV(savedBy)}\n`;
  });

  return csv;
}

/**
 * Convert game summary to JSON format
 * @param {Object} summary - Game summary object
 * @param {Array} players - Array of player objects with id and name
 * @returns {string} JSON formatted string
 */
export function convertSummaryToJSON(summary, players = []) {
  if (!summary) return '{}';

  // Create enhanced summary with player names
  const idToName = {};
  players.forEach(p => {
    idToName[p.id] = p.name;
  });

  const enhancedSummary = {
    ...summary,
    exportedAt: new Date().toISOString(),
    players: players.map(p => ({
      id: p.id,
      name: p.name
    })),
    stepsWithNames: (summary.steps || []).map((step, index) => ({
      stepNumber: index,
      playerName: idToName[step.user] || step.user || 'Unknown',
      playerId: step.user,
      grid: step.grid,
      timestamp: step.timestamp
    })),
    savesWithNames: (summary.saves || []).map(save => ({
      stepNumber: save.step,
      playerName: idToName[save.user] || save.user || 'Unknown',
      playerId: save.user,
      timestamp: save.timestamp
    }))
  };

  return JSON.stringify(enhancedSummary, null, 2);
}

/**
 * Trigger download of content as a file
 * @param {string} content - File content
 * @param {string} filename - Name of file to download
 * @param {string} mimeType - MIME type of file
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export game summary as CSV file
 * @param {Object} summary - Game summary object
 * @param {Array} players - Array of player objects
 */
export function exportAsCSV(summary, players = []) {
  const csv = convertSummaryToCSV(summary, players);
  const filename = `game-summary-${summary.roomId}-${Date.now()}.csv`;
  downloadFile(csv, filename, 'text/csv');
}

/**
 * Export game summary as JSON file
 * @param {Object} summary - Game summary object
 * @param {Array} players - Array of player objects
 */
export function exportAsJSON(summary, players = []) {
  const json = convertSummaryToJSON(summary, players);
  const filename = `game-summary-${summary.roomId}-${Date.now()}.json`;
  downloadFile(json, filename, 'application/json');
}

// Helper functions

/**
 * Escape CSV field values
 */
function escapeCSV(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serialize grid to compact string representation
 * 1 = filled, 0 = empty
 */
function serializeGrid(grid) {
  if (!Array.isArray(grid)) return '';
  return grid.map(row => row.map(cell => cell ? '1' : '0').join('')).join('|');
}
