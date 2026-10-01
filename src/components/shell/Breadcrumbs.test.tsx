/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Breadcrumbs } from '@/components/shell/Breadcrumbs';

const usePathnameMock = vi.fn<() => string>();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

describe('Breadcrumbs', () => {
  afterEach(() => {
    cleanup();
    usePathnameMock.mockReset();
  });

  it('renders nothing on the root route', () => {
    usePathnameMock.mockReturnValue('/');
    const { container } = render(<Breadcrumbs />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing on a top-level route', () => {
    usePathnameMock.mockReturnValue('/analytics');
    const { container } = render(<Breadcrumbs />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a trail for a nested route', () => {
    usePathnameMock.mockReturnValue('/commitments/abc123');
    render(<Breadcrumbs />);

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(nav).toBeTruthy();

    const link = screen.getByRole('link', { name: 'Commitments' });
    expect(link.getAttribute('href')).toBe('/commitments');
  });

  it('marks the last segment as the current page (not a link)', () => {
    usePathnameMock.mockReturnValue('/commitments/abc123');
    render(<Breadcrumbs />);

    const current = screen.getByText('Abc123');
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.tagName).not.toBe('A');
  });

  it('resolves the trailing segment to a friendly label when provided', () => {
    usePathnameMock.mockReturnValue('/commitments/abc123');
    render(<Breadcrumbs currentLabel="Balanced Commitment" />);

    const current = screen.getByText('Balanced Commitment');
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(screen.queryByText('abc123', { exact: false })).toBeNull();
  });

  it('falls back to a truncated raw id when no friendly label is available', () => {
    usePathnameMock.mockReturnValue('/commitments/9f2a7c3e1b8d4f6a');
    render(<Breadcrumbs />);

    expect(screen.getByText('9f2a7c3e…')).toBeTruthy();
  });

  it('title-cases short, hyphenated raw segments', () => {
    usePathnameMock.mockReturnValue('/commitments/overview-panel');
    render(<Breadcrumbs />);

    expect(screen.getByText('Overview Panel')).toBeTruthy();
  });

  it('links are real anchors, keyboard-focusable in document order', () => {
    usePathnameMock.mockReturnValue('/commitments/abc123/history');
    render(<Breadcrumbs />);

    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/commitments',
      '/commitments/abc123',
    ]);
  });
});
