import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      all: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/lib/backend/cors.ts',
        'src/lib/backend/withApiHandler.ts',
        'src/app/api/health/route.ts',
        'src/app/api/marketplace/listings/route.ts',
        'src/app/api/marketplace/listings/[id]/route.ts',
        'src/app/api/commitments/route.ts',
      ],
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        'src/**/*.module.css',
      ],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
