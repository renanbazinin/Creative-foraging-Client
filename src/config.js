// Central client configuration with smart environment detection.
// Priority order (first match wins):
// 1. Explicit override via VITE_API_URL env var
// 2. Local dev (hostname localhost / 127.* / ::1 OR import.meta.env.DEV)
// 3. Fallback to production (Render) URL

//const PROD_API = 'https://foragingserver-latest.onrender.com';
//const LOCAL_API = 'http://localhost:3001';
//

const PROD_API = 'https://foragingserver-latest.onrender.com';
//const LOCAL_API = 'http://localhost:3001';
const LOCAL_API = 'https://foragingserver-latest.onrender.com';
function normalize(url) {
  return url ? url.replace(/\/+$/, '') : url;
}

function detectApiUrl() {
  // Explicit override
  const envOverride = import.meta.env.VITE_API_URL;
  if (envOverride) return normalize(envOverride);

  // Browser heuristics
  if (typeof window !== 'undefined') {
    const { hostname, port, pathname } = window.location;
    const isLocalHost = (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1'
    );
    // Specific request: if running from local Vite dev (e.g. http://localhost:5173/Creative-foraging-Client/)
    if (isLocalHost || import.meta.env.DEV) {
      return normalize(LOCAL_API);
    }
    // Extra safeguard: if path starts with /Creative-foraging-Client/ but not on github.io *and* dev, still local
    if (pathname.startsWith('/Creative-foraging-Client/') && isLocalHost) {
      return normalize(LOCAL_API);
    }
  }

  // Default to production
  return normalize(PROD_API);
}

export const API_URL = detectApiUrl();
export const IS_LOCAL_BACKEND = API_URL.startsWith('http://localhost');

export function apiPath(path = '') {
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

if (typeof window !== 'undefined' && !window.__API_URL_LOGGED__) {
  console.log('[Config] API_URL =', API_URL, '| Local backend:', IS_LOCAL_BACKEND);
  window.__API_URL_LOGGED__ = true;
}
