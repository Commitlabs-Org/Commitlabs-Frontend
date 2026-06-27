import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  oxc: false,
  test: {
    globals: true,
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      all: false,
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/backend/csrf.ts',
        'src/lib/backend/env.ts',
        'src/lib/backend/parsing.ts',
        'src/lib/backend/session.ts',
        'src/lib/backend/validationErrors.ts',
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
      ],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
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
