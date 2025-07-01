import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import IstanbulPlugin from 'vite-plugin-istanbul';
import { VitePWA } from 'vite-plugin-pwa';

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  plugins: [
    react(),
    ...(process.env.NODE_ENV !== 'production'
      ? [
          IstanbulPlugin({
            include: 'src/**/*',
            extension: ['.js', '.ts', '.tsx'],
          }),
        ]
      : []),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*'],
        maximumFileSizeToCacheInBytes: 20000000,
        ignoreURLParametersMatching: [/.*/],
      },
      includeAssets: [
        'apple-touch-icon-180x180.png',
        'favicon.ico',
        'favicon.svg',
      ],
      manifest: {
        name: 'Bitauth IDE',
        short_name: 'Bitauth IDE',
        description:
          'An Integrated Development Environment for developing Bitcoin Cash contracts and protocols.',
        theme_color: '#1d2023',
        background_color: '#1d2023',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  css: {
    transformer: 'lightningcss',
    devSourcemap: true,
    lightningcss: { drafts: { nesting: true } },
  },
  build: {
    sourcemap: true,
    cssMinify: 'lightningcss',
    chunkSizeWarningLimit: 1000000,
  },
  worker: {
    format: 'es',
    plugins: () => [],
  },
  optimizeDeps: {
    esbuildOptions: {
      supported: {
        'top-level-await': true,
      },
    },
  },
  esbuild: {
    supported: {
      'top-level-await': true,
    },
  },
  server: {
    open: true,
    port: 3000,
    host: true,
  },
  preview: {
    open: true,
    port: 31313,
    host: true,
  },
});
