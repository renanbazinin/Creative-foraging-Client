import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// IMPORTANT: Set the base to the GitHub repository name so assets resolve correctly on GitHub Pages.
// Repo: renanbazinin/Creative-foraging-Client -> base must be '/Creative-foraging-Client/'
// Vite already produces hashed asset filenames in production (e.g., chunk.[hash].js) so no extra config needed for hashing.
export default defineConfig({
  base: '/Creative-foraging-Client/',
  plugins: [react()],
  build: {
    sourcemap: true, // Helpful for debugging the deployed site
    // Hashing is on by default; leaving other defaults intact
  }
});
