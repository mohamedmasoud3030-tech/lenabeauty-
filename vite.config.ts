import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          // Cache strategies for offline support
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
        manifest: {
          name: 'LenaBeauty - إدارة الصالون',
          short_name: 'LenaBeauty',
          description: 'نظام إدارة الصالونات الاحترافي - LenaBeauty',
          theme_color: '#ec4899',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          lang: 'ar',
          dir: 'rtl',
          start_url: '/dashboard',
          scope: '/',
          categories: ['business', 'productivity'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ],
          shortcuts: [
            {
              name: 'نقطة البيع',
              short_name: 'POS',
              description: 'فتح نقطة البيع مباشرة',
              url: '/pos',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
            },
            {
              name: 'لوحة التحكم',
              short_name: 'Dashboard',
              description: 'عرض الإحصائيات',
              url: '/dashboard',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Increase chunk size warning limit
      chunkSizeWarningLimit: 600,
      // Enable minification
      minify: 'esbuild',
      // No source maps in production
      sourcemap: false,
      rollupOptions: {
        output: {
          // Fine-grained code splitting
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              // Heavy chart library - separate chunk
              if (id.includes('recharts') || id.includes('d3-')) return 'chunk-charts';
              // Animation library
              if (id.includes('motion') || id.includes('framer')) return 'chunk-motion';
              // Supabase client
              if (id.includes('@supabase')) return 'chunk-supabase';
              // i18n
              if (id.includes('i18next') || id.includes('react-i18next')) return 'chunk-i18n';
              // QR code
              if (id.includes('qrcode')) return 'chunk-qrcode';
              // React core
              if (id.includes('react-dom') || id.includes('react-router')) return 'chunk-react';
              // Everything else
              return 'vendor';
            }
            // Split each page into its own chunk
            if (id.includes('/src/pages/')) {
              const match = id.match(/pages\/([^/]+)\.tsx/);
              if (match) return `page-${match[1].toLowerCase()}`;
            }
            // Split heavy shared components
            if (id.includes('/src/shared/components/')) {
              const match = id.match(/components\/([^/]+)\.tsx/);
              if (match) return `comp-${match[1].toLowerCase()}`;
            }
          },
          // Consistent file naming
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        }
      },
      // CSS code splitting
      cssCodeSplit: true,
    },
    // Optimize dependencies pre-bundling
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'clsx',
        'lucide-react',
      ],
      exclude: ['recharts'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
