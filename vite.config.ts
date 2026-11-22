import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'prompt',
          includeAssets: [
            'favicon.ico',
            'icons/*.png',
            'icons/*.svg',
            'splash/*.png',
            'imgportada/*.jpeg',
          ],
          manifest: {
            id: '/',
            name: 'SONOTOX — Clínica de Toxina Botulínica',
            short_name: 'SONOTOX',
            description: 'Calculadora y guía clínica de toxina botulínica. Puntos motores, dosis, patologías y más.',
            lang: 'es',
            dir: 'ltr',
            theme_color: '#137fec',
            background_color: '#070b12',
            display: 'standalone',
            display_override: ['standalone', 'minimal-ui'],
            orientation: 'any',
            start_url: '/?source=pwa',
            scope: '/',
            categories: ['medical', 'health'],
            icons: [
              { src: '/icons/icon-72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
              { src: '/icons/icon-96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
              { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
              { src: '/icons/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
              { src: '/icons/icon-152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
              { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
              { src: '/icons/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
              { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
              { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
          workbox: {
            cleanupOutdatedCaches: true,
            globPatterns: ['**/*.{js,css,html,ico,png,svg,jpeg,jpg,webp,woff,woff2}'],
            // Atlas facial (~2.5 MB), modelos 3D (.glb) y runtime 3D (Three.js/Draco):
            // fuera del precache inicial para mantener liviana la instalación PWA
            globIgnores: ['**/facial/**', '**/models/**', '**/draco/**', '**/three-vendor-*.js', '**/draco_*'],
            runtimeCaching: [
              {
                urlPattern: /\/(assets\/(three-vendor-|draco_)|draco\/).*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'anatomy-3d-engine',
                  expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 90 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
              {
                urlPattern: /\/facial\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'facial-atlas',
                  expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
              {
                urlPattern: /(\/models\/|\/storage\/v1\/object\/public\/anatomy-3d\/).*\.(glb|gltf)/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'anatomy-3d-models',
                  expiration: { maxEntries: 6, maxAgeSeconds: 60 * 60 * 24 * 30 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
              {
                urlPattern: /^https:\/\/www\.gstatic\.com\/draco\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'draco-decoders',
                  expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 90 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
              {
                urlPattern: /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'tailwind-cdn',
                  expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 30 },
                },
              },
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'StaleWhileRevalidate',
                options: {
                  cacheName: 'google-fonts-stylesheets',
                  expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                },
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-webfonts',
                  expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  cacheableResponse: { statuses: [0, 200] },
                },
              },
            ],
          },
        }),
      ],
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (
                id.includes('node_modules/three/') ||
                id.includes('node_modules/@react-three/') ||
                id.includes('node_modules/three-stdlib/')
              ) {
                return 'three-vendor';
              }
            },
          },
        },
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
