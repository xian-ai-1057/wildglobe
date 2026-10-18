import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // three.js + globe.gl alone are ~2 MB minified; the warning adds noise without an actionable fix.
    chunkSizeWarningLimit: 2600,
  },
});
