// Vite configuration for frontend development
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    allowedHosts: true,
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html',
      },
      output: {
        // Manual chunks for better code splitting
        manualChunks: {
          // Vendor chunks - third-party libraries
          'vendor-leaflet': ['leaflet'],
          'vendor-sortable': ['sortablejs'],
          // Feature chunks - lazy-loaded modules
          'feature-maps': [
            './src/components/map-view.js',
          ],
          'feature-collaboration': [
            './src/components/suggestion-list.js',
            './src/components/suggestion-card.js',
            './src/services/realtime-updates.js',
          ],
          'feature-expenses': [
            './src/components/expense-tracker.js',
            './src/components/expense-form.js',
            './src/components/budget-summary.js',
            './src/components/balance-sheet.js',
          ],
          'feature-documents': [
            './src/components/document-list.js',
            './src/components/document-upload.js',
          ],
        },
        // Use content hash for cache busting
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 500,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
