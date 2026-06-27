import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  oxc: false,
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      all: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/backend/cors.ts',
        'src/lib/backend/withApiHandler.ts',
        'src/lib/backend/apiResponse.ts',
        'src/app/api/health/route.ts',
        'src/app/api/metrics/route.ts',
        'src/app/api/marketplace/listings/route.ts',
        'src/app/api/marketplace/listings/[id]/route.ts',
        'src/app/api/commitments/route.ts',
        'src/app/api/commitments/search/route.ts',
      ],
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        'src/**/*.module.css',
        'src/**/*.d.ts',
        'src/lib/backend/services/contracts.ts',
      ],
      thresholds: {
        lines: 19,
        functions: 14,
        branches: 14,
        statements: 19,
      },
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
