import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/GluciMiam/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'GluciMiam',
        short_name: 'GluciMiam',
        description: 'Compteur de glucides intelligent pour diabétiques',
        theme_color: '#0a0e1a',
        background_color: '#0a0e1a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/GluciMiam/',
        icons: [
          {
            src: '/GluciMiam/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/GluciMiam/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/GluciMiam/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
  },
});
