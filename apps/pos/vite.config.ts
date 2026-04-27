import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt'],
      manifest: {
        name: 'DESAIN POS',
        short_name: 'DESAIN',
        description: 'Kasir terminal — DESAIN POS',
        theme_color: '#059669',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-mask.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\/menu\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'menu', expiration: { maxAgeSeconds: 24 * 3600 } },
          },
          {
            urlPattern: /\.(?:png|jpe?g|webp|svg)$/,
            handler: 'CacheFirst',
            options: { cacheName: 'images', expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 3600 } },
          },
          {
            urlPattern: /\/api\/v1\/sync\//,
            handler: 'NetworkOnly',
          },
        ],
        navigateFallback: '/index.html',
      },
    }),
  ],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
