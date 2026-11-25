import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NetworkProvider } from '@/components/NetworkProvider';
import { WalletProvider } from '@/components/WalletProvider';
import { LIVE_URL, REPO_URL, config } from '@/lib/config';
import { axe } from '@/test/axe';
import { Footer } from '../Footer';

function renderFooter() {
  return render(
    <WalletProvider>
      <NetworkProvider>
        <Footer />
      </NetworkProvider>
    </WalletProvider>,
  );
}

describe('Footer', () => {
  it('renders the footer landmark and visible link text', () => {
    renderFooter();

    expect(screen.getByRole('contentinfo')).toBeDefined();
    expect(screen.getByText(/CommitLabs/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Docs' }).getAttribute('href')).toBe('/docs');
    expect(screen.getByRole('link', { name: 'Protocol health' }).getAttribute('href')).toBe(
      '/protocol',
    );
    expect(screen.getByRole('link', { name: 'Live demo' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'GitHub' })).toBeDefined();
  });

  it('gives every external link a rel containing noreferrer', () => {
    renderFooter();

    const externalLinks = screen.getAllByRole('link').filter((link) => {
      const href = link.getAttribute('href') ?? '';
      return href.startsWith('http://') || href.startsWith('https://');
    });

    expect(externalLinks.length).toBeGreaterThan(0);
    expect(externalLinks.map((link) => link.getAttribute('href'))).toEqual([
      LIVE_URL,
      REPO_URL,
      config.networkDetails.explorerBaseUrl,
    ]);

    for (const link of externalLinks) {
      expect((link.getAttribute('rel') ?? '').split(/\s+/)).toContain('noreferrer');
      expect(link.getAttribute('target')).toBe('_blank');
    }
  });

  it('has no accessibility violations', async () => {
    const { container } = renderFooter();

    expect(await axe(container)).toHaveNoViolations();
  });
});
