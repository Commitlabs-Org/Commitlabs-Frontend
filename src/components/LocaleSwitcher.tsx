'use client';

import { useState, useCallback } from 'react';
import { type Locale } from '@/lib/i18n/messages';

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
};

const STORAGE_KEY = 'commitlabs:locale';

function readLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in LOCALE_LABELS) return stored as Locale;
  } catch {}
  return 'en';
}

function writeLocale(locale: Locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {}
}

interface LocaleSwitcherProps {
  onChange?: (locale: Locale) => void;
}

export function LocaleSwitcher({ onChange }: LocaleSwitcherProps) {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window !== 'undefined') return readLocale();
    return 'en';
  });

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value as Locale;
      writeLocale(next);
      setLocale(next);
      onChange?.(next);
      document.documentElement.lang = next;
    },
    [onChange],
  );

  const locales = Object.keys(LOCALE_LABELS) as Locale[];

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
      <span className="sr-only">Language</span>
      <select
        aria-label="Select language"
        onChange={handleChange}
        value={locale}
      >
        {locales.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
