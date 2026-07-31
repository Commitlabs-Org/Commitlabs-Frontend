/** @vitest-environment happy-dom */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuickCreateFab } from './QuickCreateFab';

const usePathname = vi.fn();
vi.mock('next/navigation', () => ({ usePathname: () => usePathname() }));

describe('QuickCreateFab', () => {
  it('links to create from app routes', () => {
    usePathname.mockReturnValue('/analytics');
    render(<QuickCreateFab />);
    expect(screen.getByRole('link', { name: 'Create a commitment' })).toHaveAttribute(
      'href',
      '/create',
    );
  });

  it('does not render on the create route', () => {
    usePathname.mockReturnValue('/create');
    render(<QuickCreateFab />);
    expect(screen.queryByRole('link', { name: 'Create a commitment' })).not.toBeInTheDocument();
  });
});
