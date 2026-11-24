'use client';

import { useEffect, useState } from 'react';
import { readRaw, subscribeStorage, writeRaw } from '@/lib/storage';
import {
  parseThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '@/lib/theme';

const PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];

function prefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function applyPreference(preference: ThemePreference): void {
  const root = document.documentElement;
  root.dataset.theme = resolveTheme(preference, prefersDark());
  root.dataset.themePreference = preference;
}

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>('system');
  const nextPreference =
    PREFERENCES[(PREFERENCES.indexOf(preference) + 1) % PREFERENCES.length];

  useEffect(() => {
    const syncPreference = () => {
      const current = parseThemePreference(readRaw(THEME_STORAGE_KEY));
      setPreference(current);
      applyPreference(current);
    };
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onSystemThemeChange = () => {
      const current = parseThemePreference(readRaw(THEME_STORAGE_KEY));
      if (current === 'system') applyPreference(current);
    };

    syncPreference();
    const unsubscribeStorage = subscribeStorage(THEME_STORAGE_KEY, syncPreference);
    mediaQuery?.addEventListener('change', onSystemThemeChange);

    return () => {
      unsubscribeStorage();
      mediaQuery?.removeEventListener('change', onSystemThemeChange);
    };
  }, []);

  const changePreference = () => {
    setPreference(nextPreference);
    writeRaw(THEME_STORAGE_KEY, nextPreference);
    applyPreference(nextPreference);
  };

  return (
    <button
      type="button"
      className="btn theme-toggle"
      onClick={changePreference}
      aria-label={`Color theme: ${preference}. Activate to switch to ${nextPreference}.`}
      title={`Color theme: ${preference}`}
    >
      {preference}
    </button>
  );
}
