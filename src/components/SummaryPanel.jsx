import React from 'react';
import './SummaryPanel.css';

function renderGrid(grid, cellSize = 20) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(10, ${cellSize}px)`,
      gridTemplateRows: `repeat(10, ${cellSize}px)`,
      gap: '1px',
      background: '#222',
      border: '1px solid #444',
      margin: '0 auto',
      width: cellSize * 10,
      height: cellSize * 10,
    }}>
      {grid.flatMap((row, r) =>
        row.map((cell, c) => (
          <div
            key={`${r}-${c}`}
            style={{
              width: cellSize,
              height: cellSize,
              background: cell ? '#0f0' : '#111',
              borderRadius: cell ? 4 : 0,
              boxShadow: cell ? '0 0 2px #0f0' : 'none',
            }}
          />
        ))
      )}
    </div>
  );
}

export default function SummaryPanel({ summary, players }) {
  if (!summary) return null;
  // Map userId to name
  const idToName = {};
  (players || []).forEach(p => { idToName[p.id] = p.name; });

  // For offline, fallback to Player 1/2
  function getName(id) {
    if (!id) return 'Unknown';
    return idToName[id] || id || 'Unknown';
  }

  // Build a lookup for saved steps
  // Map step index -> Set of user ids who saved that step (deduplicated)
  const savedSteps = {};
  (summary.saves || []).forEach(s => {
    const idx = Number(s.step);
    if (!Number.isFinite(idx)) return;
    if (!savedSteps[idx]) savedSteps[idx] = new Set();
    savedSteps[idx].add(s.user);
  });

  return (
    <div className="summary-panel">
      <h3>Game Summary</h3>
      <div style={{ marginBottom: 12 }}>
        <span>Room: {summary.roomId}</span> | <span>Total Moves: {summary.totalMoves}</span> | <span>Total Saves: {summary.totalSaves}</span>
      </div>
      <table className="summary-table">
        <thead>
          <tr>
            <th>Step</th>
            <th>Player</th>
            <th>Shape</th>
            <th>Saved?</th>
          </tr>
        </thead>
        <tbody>
          {(summary.steps || []).map((step, i) => {
            const savers = savedSteps[i] ? Array.from(savedSteps[i]) : [];
            return (
              <tr key={i}>
                <td>{i === 0 ? '0 (init)' : i}</td>
                <td>{getName(step.user)}</td>
                <td>{renderGrid(step.grid)}</td>
                <td>{savers.length ? `Saved by ${savers.map(id => getName(id)).join(', ')}` : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
