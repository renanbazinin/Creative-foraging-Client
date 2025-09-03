// Central client configuration
// Controls base URL for backend server API calls.
// Override by defining VITE_API_URL in an .env file at project root.

const DEFAULT_API_URL = 'https://foragingserver-latest.onrender.com';

// Normalize (strip trailing slashes) for consistency
function normalize(url) {
  return url ? url.replace(/\/+$/, '') : url;
}

export const API_URL = normalize(import.meta.env.VITE_API_URL) || DEFAULT_API_URL;

// Optional helper to build endpoint URLs
export function apiPath(path = '') {
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

if (typeof window !== 'undefined' && !window.__API_URL_LOGGED__) {
  console.log('[Config] API_URL =', API_URL);
  window.__API_URL_LOGGED__ = true;
}
