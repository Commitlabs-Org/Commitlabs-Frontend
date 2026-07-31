export interface ShortcutEntry {
  /** Display label for the key combination, e.g. "⌘K". */
  keys: string;
  description: string;
  group: string;
}

/**
 * Single source of truth for global keyboard shortcuts, so the help overlay
 * (`KeyboardShortcutsOverlay`) can never drift out of sync with the actual
 * bindings. When a new global shortcut is added elsewhere in the app, add
 * an entry here too.
 */
export const GLOBAL_SHORTCUTS: ShortcutEntry[] = [
  {
    keys: '⌘K / Ctrl+K',
    description: 'Open the command palette',
    group: 'Navigation',
  },
  {
    keys: '?',
    description: 'Show this shortcuts overlay',
    group: 'Navigation',
  },
  {
    keys: 'Esc',
    description: 'Close the open dialog or overlay',
    group: 'Dialogs',
  },
  {
    keys: '↑ / ↓',
    description: 'Move the highlighted item in a list or the command palette',
    group: 'Dialogs',
  },
  {
    keys: 'Enter',
    description: 'Activate the highlighted item',
    group: 'Dialogs',
  },
];

export function groupShortcuts(entries: ShortcutEntry[]): Map<string, ShortcutEntry[]> {
  const grouped = new Map<string, ShortcutEntry[]>();
  for (const entry of entries) {
    const existing = grouped.get(entry.group);
    if (existing) {
      existing.push(entry);
    } else {
      grouped.set(entry.group, [entry]);
    }
  }
  return grouped;
}
