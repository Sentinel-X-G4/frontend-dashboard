import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En dev, /api est relayé vers le backend (VITE_BACKEND_URL, défaut localhost:3000)
const backend = process.env.VITE_BACKEND_URL || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': backend
    }
  }
});
