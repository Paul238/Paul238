import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// În dezvoltare (npm run dev) cererile /api merg la serverul Docker.
// Alt port: ASCEND_API=http://localhost:9000 npm run dev
const api = process.env.ASCEND_API ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: { '/api': { target: api, changeOrigin: true } },
  },
});
