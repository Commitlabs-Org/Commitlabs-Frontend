import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'escrow-client': fileURLToPath(
        new URL('./packages/escrow-client/src/index.ts', import.meta.url)
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'contracts', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportOnFailure: true,
      include: ['src/lib/**', 'src/components/**', 'src/app/**'],
      exclude: [
        '**/*.{test,spec}.{ts,tsx}',
        '**/test/**',
        '**/__tests__/**',
        '**/__fixtures__/**',
        '**/fixtures/**',
      ],
      thresholds: {
        'src/app/**': {
          statements: 72,
          branches: 80,
          functions: 67,
          lines: 72,
        },
        'src/components/**': {
          statements: 80,
          branches: 80,
          functions: 77,
          lines: 80,
        },
        'src/lib/**': {
          statements: 82,
          branches: 76,
          functions: 89,
          lines: 82,
        },
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportOnFailure: true,
      include: ['src/lib/**', 'src/components/**', 'src/app/**'],
      exclude: [
        '**/*.{test,spec}.{ts,tsx}',
        '**/test/**',
        '**/__tests__/**',
        '**/__fixtures__/**',
        '**/fixtures/**',
      ],
      thresholds: {
        'src/app/**': {
          statements: 72,
          branches: 80,
          functions: 67,
          lines: 72,
        },
        'src/components/**': {
          statements: 80,
          branches: 80,
          functions: 77,
          lines: 80,
        },
        'src/lib/**': {
          statements: 82,
          branches: 76,
          functions: 89,
          lines: 82,
        },
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportOnFailure: true,
      include: ['src/lib/**', 'src/components/**', 'src/app/**'],
      exclude: [
        '**/*.{test,spec}.{ts,tsx}',
        '**/test/**',
        '**/__tests__/**',
        '**/__fixtures__/**',
        '**/fixtures/**',
      ],
      thresholds: {
        'src/app/**': {
          statements: 72,
          branches: 80,
          functions: 67,
          lines: 72,
        },
        'src/components/**': {
          statements: 80,
          branches: 80,
          functions: 77,
          lines: 80,
        },
        'src/lib/**': {
          statements: 82,
          branches: 76,
          functions: 89,
          lines: 82,
        },
      },
    },
  },
});
