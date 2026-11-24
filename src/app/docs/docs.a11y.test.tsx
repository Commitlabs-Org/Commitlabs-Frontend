import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from '@/test/axe';
import { NetworkProvider } from '@/components/NetworkProvider';
import { DocsContent } from './DocsContent';

vi.mock('@/lib/protocol', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/protocol')>()),
  useProtocolParams: () => ({
    params: {
      penalties: { safe: 300, balanced: 500, aggressive: 800 },
    },
    loading: false,
    isFallback: false,
  }),
}));

describe('Docs page (/docs) accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <NetworkProvider>
        <main id="main-content">
          <DocsContent />
        </main>
      </NetworkProvider>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
