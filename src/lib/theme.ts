export const THEME_STORAGE_KEY = 'commitlabs-theme';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = Exclude<ThemePreference, 'system'>;

export function parseThemePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function resolveTheme(
  preference: ThemePreference,
  prefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}
