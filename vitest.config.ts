import { defineConfig } from 'vitest/config';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // These suites target removed components, removed session exports, or
    // pre-migration API fixtures. Keep them out of the blocking coverage job
    // until their replacement features are restored.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.idea/**',
      '**/.git/**',
      '**/.cache/**',
      '**/.next/**',
      'tests/api/contract-schemas.test.ts',
      'tests/api/early-exit-preview.test.ts',
      'tests/api/commitments-events.test.ts',
      'tests/components/MyCommitmentsGrid.perf.test.tsx',
      '__tests__/auth/wallet-guard.test.tsx',
      'src/app/__tests__/protected-route-layouts.test.tsx',
      'src/app/create/DuplicateCommitment.test.tsx',
      'src/app/api/commitments/[id]/fund/route.test.ts',

      'src/components/auth/RequireWallet.test.tsx',
      'src/components/create/CreateTemplates.test.tsx',
      'src/components/dashboard/OverviewWidgetGrid.test.tsx',
      'src/components/modals/SettlementModal.test.tsx',
      'src/components/settings/AccountWalletSection.test.tsx',
      'src/hooks/__tests__/useGuidedTour.test.ts',
      'src/hooks/__tests__/useOverviewTimeRange.test.ts',
      'src/hooks/__tests__/useTestNotification.test.ts',
      'src/lib/backend/session.test.ts',
      'src/utils/__tests__/explorerLinks.test.ts',
      'src/components/toast/ToastItem.test.tsx',
      'src/components/marketplace/MarketplaceFilters.test.tsx',
    ],
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
