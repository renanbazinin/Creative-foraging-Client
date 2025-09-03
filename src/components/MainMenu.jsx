import React, { useEffect, useState } from 'react';
import { API_URL } from '../config';
import './MainMenu.css';

export default function MainMenu({ onSelectGameMode, showGallery, galleryCount }) {
  const [health, setHealth] = useState({ status: 'LOADING', activeRooms: null, connectedPlayers: null, timestamp: null });
  const [healthError, setHealthError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  useEffect(() => {
    const HEALTH_URL = `${API_URL}/health`;
    let abort = false;
    const fetchHealth = async () => {
      try {
        const res = await fetch(HEALTH_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!abort) {
          setHealth({
            status: data.status || 'UNKNOWN',
            activeRooms: data.activeRooms ?? 0,
            connectedPlayers: data.connectedPlayers ?? 0,
            timestamp: data.timestamp || new Date().toISOString()
          });
          setHealthError(null);
          setLastFetch(Date.now());
        }
      } catch (e) {
        if (!abort) {
          setHealthError(e.message);
          setHealth(h => ({ ...h, status: 'ERROR' }));
        }
      }
    };
    fetchHealth();
  const interval = setInterval(fetchHealth, 15000); // refresh every 15s
    return () => { abort = true; clearInterval(interval); };
  }, []);

  const statusColor = (s) => {
    if (s === 'OK') return '#18ff6d';
    if (s === 'ERROR') return '#ff4d4d';
    if (s === 'LOADING') return '#ffaa33';
    return '#ccc';
  };

  return (
    <div className="main-menu">
      <div className="menu-header">
        <h1>Creative Foraging</h1>
        <p className="tagline">A silent, sculpting-and-guessing game</p>
      </div>

      <div className="game-modes">
        <div className="mode-card available" onClick={() => onSelectGameMode('offline')}>
          <div className="mode-icon">
            <img src="https://i.imgur.com/LzMFwvl.png" alt="Offline" />
          </div>
          <h3>Offline Game</h3>
          <p>Two players on the same device</p>
          <div className="mode-status">Available</div>
        </div>

        <div className="mode-card available" onClick={() => onSelectGameMode('online')}>
          <div className="mode-icon">
            <img src="https://i.imgur.com/zigkT9o.png" alt="Online" />
          </div>
          <h3>Online Game</h3>
          <p>Play with friends over the internet</p>
          <div className="mode-status">Available</div>
          <div className="health-panel" onClick={(e) => e.stopPropagation()}>
            <div className="health-header">
              <span className="dot" style={{ backgroundColor: statusColor(health.status) }} />
              <span className="health-title">Server Health</span>
              <button className="refresh-btn" title="Refresh" onClick={(e) => { e.preventDefault(); e.stopPropagation(); const HEALTH_URL = `${API_URL}/health`; setLastFetch(null); setHealth(h => ({ ...h, status: 'LOADING' })); fetch(HEALTH_URL).then(r => r.json()).then(d => setHealth({ status: d.status, activeRooms: d.activeRooms, connectedPlayers: d.connectedPlayers, timestamp: d.timestamp })).catch(err => { setHealthError(err.message); setHealth(h => ({ ...h, status: 'ERROR' })); }); }}>
                ↻
              </button>
            </div>
            {healthError ? (
              <div className="health-error">{healthError}</div>
            ) : (
              <div className="health-stats">
                <div className="stat"><label>Status:</label><span style={{ color: statusColor(health.status) }}>{health.status}</span></div>
                <div className="stat"><label>Active Rooms:</label><span>{health.activeRooms ?? '—'}</span></div>
                <div className="stat"><label>Players Online:</label><span>{health.connectedPlayers ?? '—'}</span></div>
                <div className="timestamp">{health.timestamp && new Date(health.timestamp).toLocaleTimeString()}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="menu-actions">
        <button className="gallery-button" onClick={showGallery}>
          <span className="button-icon">🖼️</span>
          View Gallery ({galleryCount})
        </button>
      </div>

      <div className="game-info">
        <h3>How to Play</h3>
        <div className="rules-preview">
          <ul>
            <li>Reshape 10 blocks into recognizable objects</li>
            <li>Keep all blocks connected (no diagonal connections)</li>
            <li>Take turns moving blocks silently</li>
            <li>Guess what your partner is creating</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
