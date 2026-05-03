/**
 * Configuration Vite pour Testmo Dashboard
 * Build tool moderne et performant (LEAN principles)
 */

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.BACKEND_URL || 'http://localhost:3001';

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        // Proxy vers le backend — configurable via BACKEND_URL dans .env
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
        '/trpc': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      // Optimisation LEAN
      chunkSizeWarningLimit: 1000,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
        },
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (['react', 'react-dom', 'react-router-dom'].some((m) => id.includes(m))) return 'vendor-react';
              if (['chart.js', 'react-chartjs-2'].some((m) => id.includes(m))) return 'vendor-charts';
              if (['html2canvas', 'jspdf', 'docx'].some((m) => id.includes(m))) return 'vendor-export';
              if (id.includes('lucide-react')) return 'vendor-ui';
            }
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        thresholds: {
          branches: 35,
          functions: 35,
          lines: 50,
          statements: 50,
        },
        exclude: [
          'src/test/setup.js',
          'src/**/*.test.{js,jsx}',
          'src/**/*.spec.{js,jsx}',
          'src/styles/**',
          'src/utils/docxGenerator.ts',
        ],
      },
    },
  };
});
