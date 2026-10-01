// @vitest-environment happy-dom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CreateLayout from '@/app/create/layout';
import SettingsLayout from '@/app/settings/layout';
import CommitmentsLayout from '@/app/commitments/layout';
import { WalletProvider } from '@/components/auth/WalletProvider';

const pathnameMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
}));

describe('route auth guards', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.freighterApi;
    pathnameMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  it.each([
    {
      name: 'create',
      pathname: '/create',
      Layout: CreateLayout,
      content: 'Create page body',
    },
    {
      name: 'settings',
      pathname: '/settings',
      Layout: SettingsLayout,
      content: 'Settings page body',
    },
    {
      name: 'commitments',
      pathname: '/commitments',
      Layout: CommitmentsLayout,
      content: 'Commitments page body',
    },
  ])(
    'shows the wallet prompt for the $name route when disconnected',
    ({ pathname, Layout, content }) => {
      pathnameMock.mockReturnValue(pathname);

      render(
        <WalletProvider>
          <Layout>
            <div>{content}</div>
          </Layout>
        </WalletProvider>,
      );

      expect(screen.queryByText(content)).toBeNull();
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Connect your wallet to continue' })).toBeTruthy();
    },
  );
});
