/** @vitest-environment happy-dom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AppSidebar } from './AppSidebar';

vi.mock('next/navigation', () => ({ usePathname: () => '/analytics' }));

describe('AppSidebar', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('persists collapsed state and keeps labels accessible', () => {
    render(<AppSidebar />);
    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' });

    fireEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('link', { name: 'Analytics' })).toHaveAttribute('title', 'Analytics');
    expect(localStorage.getItem('commitlabs:sidebar-collapsed')).toBe('true');
  });

  it('marks the active route', () => {
    render(<AppSidebar />);
    expect(screen.getByRole('link', { name: 'Analytics' })).toHaveAttribute('aria-current', 'page');
  });
});
