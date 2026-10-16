import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { APP_NAME, APP_TAGLINE } from './src/lib/brand';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'brand-html-metadata',
      transformIndexHtml(html) {
        return html
          .replaceAll('__APP_NAME__', APP_NAME)
          .replaceAll('__APP_TAGLINE__', APP_TAGLINE);
      },
    },
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'pwa-192.png', 'pwa-512.png', 'pwa-maskable-512.png'],
      manifest: {
        id: '/',
        name: APP_NAME,
        short_name: APP_NAME,
        lang: 'fr',
        description: APP_TAGLINE,
        start_url: '/',
        scope: '/',
        theme_color: '#FFC93C',
        background_color: '#FFFDF7',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Ajouter un enregistré',
            url: '/espace/ajouter',
            icons: [{ src: '/pwa-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Mes enregistrés',
            url: '/espace',
            icons: [{ src: '/pwa-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/admin-pages-*.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[^/]+\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  build: {
    sourcemap: false,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'INVALID_ANNOTATION' && warning.id?.includes('/node_modules/zod/')) return;
        warn(warning);
      },
      output: {
        manualChunks(id) {
          if (id.includes('/src/pages/AdminPages.tsx')) return 'admin-pages';
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (/node_modules\/@supabase\//.test(id)) return 'supabase';
          if (/node_modules\/@tanstack\/react-query\//.test(id)) return 'tanstack-query';
          return undefined;
        },
      },
    },
  },
});
