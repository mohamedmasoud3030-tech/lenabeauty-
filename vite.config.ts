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
        registerType: 'prompt',
        workbox: {
          // Reports are online-data only; do not make every PWA install pay for
          // the large chart engine before that lazy route is requested.
          globIgnores: ['**/chunk-charts-*.js'],
          // Only cache explicitly public third-party fonts. Business/customer
          // images (including signed Storage URLs) stay network-only so logout
          // or account changes cannot expose them from a shared-device cache.
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
        manifest: {
          name: 'Lena Beauty - إدارة مركز التجميل',
          short_name: 'Lena Beauty',
          description: 'نظام إدارة مركز التجميل - Lena Beauty',
          theme_color: '#8B5CF6',
          background_color: '#FCFAFF',
          display: 'standalone',
          orientation: 'portrait',
          lang: 'ar',
          dir: 'rtl',
          start_url: '/#/dashboard',
          scope: '/',
          categories: ['business', 'productivity'],
          // One canonical vector mark prevents favicon / install-icon / shortcut
          // drift when the product identity changes again.
          icons: [
            {
              src: '/lena-mark.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any'
            }
          ],
          shortcuts: [
            {
              name: 'نقطة البيع',
              short_name: 'POS',
              description: 'فتح نقطة البيع مباشرة',
              url: '/#/pos',
              icons: [{ src: '/lena-mark.svg', sizes: 'any', type: 'image/svg+xml' }]
            },
            {
              name: 'لوحة التحكم',
              short_name: 'Dashboard',
              description: 'عرض الإحصائيات',
              url: '/#/dashboard',
              icons: [{ src: '/lena-mark.svg', sizes: 'any', type: 'image/svg+xml' }]
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
        'recharts',
        'use-sync-external-store/shim/with-selector',
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Allow the live-preview host to reach the dev server (sandbox preview).
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});
