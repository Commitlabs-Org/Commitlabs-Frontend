// @vitest-environment happy-dom
//
// Supplementary coverage for landing Footer:
//   • Exhaustive link-group href assertions
//   • External-link safety (rel="noopener noreferrer" + target="_blank")
//   • Internal links must NOT have target=_blank

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Footer from '../Footer';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    target,
    rel,
    'aria-label': ariaLabel,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    React.createElement('a', { href, className, target, rel, 'aria-label': ariaLabel, ...rest }, children),
}));

vi.mock('react-icons/fa', () => ({
  FaTwitter: ({ className }: { className?: string }) =>
    React.createElement('svg', { 'data-testid': 'icon-twitter', className }),
  FaGithub: ({ className }: { className?: string }) =>
    React.createElement('svg', { 'data-testid': 'icon-github', className }),
}));

function getLink(nameOrText: string): HTMLAnchorElement {
  return screen.getByRole('link', { name: new RegExp(nameOrText, 'i') }) as HTMLAnchorElement;
}

describe('Footer — link-group hrefs', () => {
  it('GitHub resource link points to the correct external URL', () => {
    render(<Footer />);
    const gh = getLink('GitHub');
    expect(gh).toHaveAttribute('href', 'https://github.com/commitlabs');
  });

  it('Documentation link exists in the Resources group', () => {
    render(<Footer />);
    const resources = screen.getByRole('heading', { name: /resources/i }).closest('div')!;
    expect(within(resources as HTMLElement).getByText('Documentation')).toBeInTheDocument();
  });

  it('Whitepaper link exists in the Resources group', () => {
    render(<Footer />);
    const resources = screen.getByRole('heading', { name: /resources/i }).closest('div')!;
    expect(within(resources as HTMLElement).getByText('Whitepaper')).toBeInTheDocument();
  });

  it('Community group contains Twitter, Discord, Telegram, Forum links', () => {
    render(<Footer />);
    const community = screen.getByRole('heading', { name: /community/i }).closest('div')!;
    ['Twitter', 'Discord', 'Telegram', 'Forum'].forEach((name) => {
      expect(within(community as HTMLElement).getByText(name)).toBeInTheDocument();
    });
  });

  it('social icon Twitter link points to twitter.com', () => {
    render(<Footer />);
    const twitterLinks = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('href')?.includes('twitter.com'));
    expect(twitterLinks.length).toBeGreaterThan(0);
    expect(twitterLinks[0]).toHaveAttribute('href', 'https://twitter.com/commitlabs');
  });

  it('social icon GitHub link points to github.com', () => {
    render(<Footer />);
    const ghLinks = screen
      .getAllByRole('link')
      .filter(
        (l) =>
          l.getAttribute('href')?.includes('github.com') &&
          l.getAttribute('aria-label')?.toLowerCase() === 'github',
      );
    expect(ghLinks.length).toBeGreaterThan(0);
  });
});

describe('Footer — external-link safety', () => {
  it('social icon links have rel="noopener noreferrer"', () => {
    render(<Footer />);
    const socialLinks = screen
      .getAllByRole('link')
      .filter(
        (l) =>
          l.getAttribute('href')?.startsWith('http') &&
          l.getAttribute('aria-label') !== null,
      );
    socialLinks.forEach((link) => {
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
      expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
    });
  });

  it('social icon links open in a new tab', () => {
    render(<Footer />);
    const socialLinks = screen
      .getAllByRole('link')
      .filter(
        (l) =>
          l.getAttribute('href')?.startsWith('http') &&
          l.getAttribute('aria-label') !== null,
      );
    socialLinks.forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  it('internal navigation links do not have target=_blank', () => {
    render(<Footer />);
    const allLinks = screen.getAllByRole('link');
    const internalLinks = allLinks.filter((l) => {
      const href = l.getAttribute('href');
      return href && !href.startsWith('http') && !href.startsWith('#');
    });
    internalLinks.forEach((link) => {
      expect(link).not.toHaveAttribute('target', '_blank');
    });
  });

  it('each external social link carries an accessible aria-label', () => {
    render(<Footer />);
    const externalLinks = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('href')?.startsWith('https://') && l.closest('li'));
    externalLinks.forEach((link) => {
      const label = link.getAttribute('aria-label');
      expect(label).toBeTruthy();
    });
  });
});
