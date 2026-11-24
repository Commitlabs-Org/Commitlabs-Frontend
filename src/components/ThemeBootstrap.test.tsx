import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { ThemeBootstrap } from './ThemeBootstrap';
import { THEME_STORAGE_KEY } from '@/lib/theme';

afterEach(() => {
  localStorage.clear();
});

describe('ThemeBootstrap', () => {
  it('stamps the inline bootstrap script with the request nonce', () => {
    const markup = renderToStaticMarkup(<ThemeBootstrap nonce="request-nonce" />);

    expect(markup).toContain('<script nonce="request-nonce">');
    expect(markup).toContain(THEME_STORAGE_KEY);
    expect(markup).toContain('prefers-color-scheme: dark');
  });

  it('applies the stored theme before rendering the page', () => {
    const markup = renderToStaticMarkup(<ThemeBootstrap nonce="request-nonce" />);
    const script =
      /<script nonce="request-nonce">([\s\S]*)<\/script>/.exec(markup)?.[1];
    if (!script) throw new Error('theme bootstrap script is missing');

    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const root = document.createElement('html');
    const executeBootstrap = new Function(
      'localStorage',
      'window',
      'document',
      script,
    );
    executeBootstrap(
      localStorage,
      { matchMedia: () => ({ matches: false }) },
      { documentElement: root },
    );

    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.themePreference).toBe('dark');
  });
});
