import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { ThemeToggle } from './ThemeToggle';
import { THEME_STORAGE_KEY } from '@/lib/theme';

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.themePreference;
});

describe('ThemeToggle', () => {
  it('cycles through system, light, and dark while persisting the preference', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const toggle = screen.getByRole('button', {
      name: 'Color theme: system. Activate to switch to light.',
    });

    await user.click(toggle);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(toggle.getAttribute('aria-label')).toBe(
      'Color theme: light. Activate to switch to dark.',
    );

    await user.click(toggle);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(toggle.getAttribute('aria-label')).toBe(
      'Color theme: dark. Activate to switch to system.',
    );

    await user.click(toggle);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    expect(document.documentElement.dataset.themePreference).toBe('system');
  });
});
