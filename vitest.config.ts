import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    environment: 'jsdom',
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/components/ComparisonPanel.tsx',
        'src/lib/**',
        'src/hooks/**',
        'src/utils/**',
        'src/app/api/health/route.ts',
        'src/app/api/metrics/route.ts',
        'src/app/api/marketplace/listings/route.ts',
        'src/app/api/marketplace/listings/[id]/route.ts',
        'src/app/api/commitments/route.ts',
        'src/app/api/commitments/search/route.ts',
        'scripts/routeCoverage.ts',
      ],
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        'tests/**',
        'src/**/*.test.*',
        'src/**/*.spec.*',
        'src/**/__tests__/**',
        'src/**/*.module.css',
        'src/**/*.d.ts',
        'src/**/index.ts',
      ],
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
