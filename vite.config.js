import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'xn — notes',
        short_name: 'xn',
        description: 'Personal offline markdown notes',
        theme_color: '#060d09',
        background_color: '#09100d',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache every built asset so the whole app shell is available offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // SPA: serve index.html for any navigation when offline.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      // Run the service worker during `npm run dev` too, so offline is testable
      // without a production build.
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
})
