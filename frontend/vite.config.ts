import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { execSync } from 'node:child_process';

function gitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'local';
  }
}

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __BUILD_COMMIT__: JSON.stringify(gitCommit()),
  },
  server: {
    port: 3000,
    proxy: {
<<<<<<< Updated upstream
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
=======
      // Proxied to the Flask backend when it is running.
      // If it is not running the app falls back to Demo Mode automatically.
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/uploads': { target: 'http://127.0.0.1:5000', changeOrigin: true },
>>>>>>> Stashed changes
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
