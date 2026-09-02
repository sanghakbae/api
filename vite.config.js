import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// During dev, /proxy and /analyze are forwarded to the local Cloudflare Worker
// (wrangler dev on :8799) so cross-origin API calls work without CORS issues.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'API Manager',
        short_name: 'API Manager',
        description: 'API 테스트·저장·분석·문서 관리 도구',
        lang: 'ko',
        theme_color: '#0b0d12',
        background_color: '#0b0d12',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell (keep it light — heavy diagram libs load on demand).
        globPatterns: ['**/*.{css,html,svg,png,woff2}', 'assets/{index,firebase,react}-*.js'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/proxy/, /^\/analyze/],
        runtimeCaching: [
          {
            // Lazily-loaded chunks (mermaid, etc.) — cache after first use so the
            // guide works offline too, without bloating the initial install.
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/') && /\.(js|css)$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'lazy-chunks', expiration: { maxEntries: 80 } },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
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
