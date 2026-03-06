import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Sites Flow - Construction Management App',
        short_name: 'Sites Flow',
        description: 'Complete construction site management solution for tracking attendance, materials, and projects',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        id: 'sites-flow-app',
        icons: [
          {
            src: 'Sites Flow.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'Sites Flow.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'Sites Flow.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ],
        categories: ['business', 'productivity', 'utilities'],
        lang: 'en',
        dir: 'ltr',
        prefer_related_applications: false
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firebase-firestore-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 12 // 12 hours
              }
            }
          },
          {
            urlPattern: /^https:\/\/firebase\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firebase-storage-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 12 // 12 hours
              }
            }
          }
        ]
      },
      strategies: 'generateSW',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
  css: {
    postcss: true
  },
  server: {
    headers: {
      'Content-Security-Policy': "script-src 'self' 'unsafe-eval' 'unsafe-inline';"
    }
  }
})