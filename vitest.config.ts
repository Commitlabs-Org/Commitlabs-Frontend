import { defineConfig } from 'vitest/config'
import path from 'path'
import ts from 'typescript'

const settlementModalTestTransform = {
  name: 'settlement-modal-test-transform',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    const normalizedId = id.replace(/\\/g, '/')
    const shouldTransform =
      normalizedId.endsWith('/src/components/modals/SettlementModal.tsx') ||
      normalizedId.endsWith('/tests/SettlementModal.test.tsx')

    if (!shouldTransform) return null

    return {
      code: ts.transpileModule(code, {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
        },
        fileName: id,
      }).outputText,
      map: null,
    }
  },
}

export default defineConfig({
  plugins: [settlementModalTestTransform],
  test: {
    globals: true,
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
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
