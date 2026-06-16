import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// During dev, /proxy is forwarded to the local Cloudflare Worker (wrangler dev on :8787)
// so that arbitrary cross-origin API calls work without CORS issues.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/proxy': 'http://localhost:8799',
      '/analyze': 'http://localhost:8799',
    },
  },
})
