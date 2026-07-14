import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,       // expose on 0.0.0.0 — required so LAN devices can reach the dev server
    strictPort: true,
    proxy: {
      // Dev only: forward /api calls to local Express backend.
      // In production, VITE_API_URL points directly to the Railway URL.
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'build',       // Vercel outputDirectory matches this
    sourcemap: false,      // keep bundle small in production
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          icons:  ['react-icons'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
