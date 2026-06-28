export interface KeyboardShortcut {
  id: string
  group: 'Global' | 'Navigation' | 'Dialogs'
  keys: string[]
  label: string
  description: string
}

export const keyboardShortcuts: KeyboardShortcut[] = [
  {
    id: 'command-palette',
    group: 'Global',
    keys: ['Cmd/Ctrl', 'K'],
    label: 'Command palette',
    description: 'Open command palette',
  },
  {
    id: 'keyboard-shortcuts',
    group: 'Global',
    keys: ['?'],
    label: 'Keyboard shortcuts',
    description: 'Show this shortcuts reference',
  },
  {
    id: 'close-dialog',
    group: 'Dialogs',
    keys: ['Esc'],
    label: 'Close dialog',
    description: 'Close the active modal or overlay',
  },
]

export const shortcutGroups = keyboardShortcuts.reduce<Record<KeyboardShortcut['group'], KeyboardShortcut[]>>(
  (groups, shortcut) => {
    groups[shortcut.group].push(shortcut)
    return groups
  },
  {
    Global: [],
    Navigation: [],
    Dialogs: [],
  }
)

export function isCommandPaletteShortcut(event: KeyboardEvent): boolean {
  return event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)
}

