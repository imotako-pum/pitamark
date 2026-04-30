import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const WORKERS_DEV = 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/rooms': {
        target: WORKERS_DEV,
        changeOrigin: true,
        ws: true,
      },
      '/health': {
        target: WORKERS_DEV,
        changeOrigin: true,
      },
    },
  },
});
