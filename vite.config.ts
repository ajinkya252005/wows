import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(rootDir, 'client'),
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      allow: [path.resolve(rootDir)],
    },
    proxy: {
      '/api': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
      '/health': 'http://localhost:3000',
    },
  },
  build: {
    outDir: path.resolve(rootDir, 'dist/client'),
    emptyOutDir: true,
  },
});
