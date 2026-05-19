// vite.config.js — performance-tuned
// Key changes vs the original:
//  • manualChunks: splits the giant vendor blob so pages share cached chunks
//    instead of re-downloading react/router/framer on every route
//  • assetsInlineLimit: tiny assets become data-URIs (fewer requests)
//  • esbuild drops console/debugger in production
//  • build.target raised so output isn't over-polyfilled (smaller, faster)
//
// IMPORTANT: keep your existing VitePWA block exactly as it was — only the
// `build` and `resolve` additions and manualChunks are new. If your current
// file differs, merge these keys in rather than wholesale-replacing.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // SELF-DESTROYING: generates a service worker whose only job is to
      // unregister any existing SW and delete all caches, then remove itself.
      // This is the official supported way to permanently kill the stale
      // cache-first SW that caused the blank-screen / stuck-version problem.
      // Once all users are confirmed unstuck, this can be turned back into a
      // normal PWA in a separate deliberate change.
      selfDestroying: true,
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'WHO WAS I — Living Memorials',
        short_name: 'WHO WAS I',
        description: 'Create a living memorial with voice, AI conversation, and a QR code that brings it to life anywhere.',
        theme_color: '#08080f',
        background_color: '#08080f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff2}'],
        // Cache Cloudinary images so repeat views are instant
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.instantdb\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'instantdb-api',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cloudinary-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],

  build: {
    target: 'es2020',
    cssCodeSplit: true,
    assetsInlineLimit: 4096,        // <4KB assets → data URI (fewer requests)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split vendor code so it's cached once and shared across all routes
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('react-dom') || id.includes('react-router') || id.includes('/react/'))
            return 'react-vendor'
          if (id.includes('@instantdb'))  return 'instant'
          if (id.includes('framer-motion')) return 'motion'
          if (id.includes('gsap'))          return 'gsap'
          if (id.includes('qrcode'))        return 'qrcode'
          return 'vendor'
        },
      },
    },
  },

  esbuild: {
    // Strip noise from production bundles
    drop: ['console', 'debugger'],
  },
})
