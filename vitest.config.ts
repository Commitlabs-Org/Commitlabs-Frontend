import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/app/api/health/**',
        'src/app/api/commitments/**',
        'src/utils/response.ts',
        'src/lib/backend/withApiHandler.ts',
        'src/lib/backend/apiResponse.ts',
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
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})