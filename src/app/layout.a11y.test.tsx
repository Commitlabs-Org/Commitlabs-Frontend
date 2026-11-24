import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from '@/test/axe';
import RootLayout from './layout';

vi.mock('next/headers', () => ({
  headers: () => new Map<string, string>(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('@/lib/soroban/protocol', () => ({
  getProtocolStatus: vi.fn().mockResolvedValue({ status: 'ok', paused: false }),
}));

vi.mock('@/lib/soroban/admin', () => ({
  getAdmin: vi.fn().mockResolvedValue(null),
}));

describe('RootLayout accessibility', () => {
  it('skip link is the first tab stop and moves focus to #main-content', async () => {
    const user = userEvent.setup();
    render(
      <RootLayout>
        <h1>Home</h1>
      </RootLayout>,
    );

    await user.tab();
    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(document.activeElement).toBe(skipLink);
    expect(skipLink.getAttribute('href')).toBe('#main-content');

    const main = document.getElementById('main-content');
    expect(main).not.toBeNull();
    expect(main?.tagName).toBe('MAIN');
    expect(main?.getAttribute('tabindex')).toBe('-1');

    // Simulate activating the skip link targeting #main-content
    main?.focus();
    expect(document.activeElement).toBe(main);
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <RootLayout>
        <h1>Home</h1>
      </RootLayout>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
