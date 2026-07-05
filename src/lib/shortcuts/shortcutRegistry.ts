export type ShortcutArea = 'Global' | 'Navigation' | 'Dialogs'

export interface KeyboardShortcut {
  id: string
  area: ShortcutArea
  keys: readonly string[]
  label: string
  description: string
}

export const KEYBOARD_SHORTCUTS = [
  {
    id: 'command-palette',
    area: 'Global',
    keys: ['Cmd', 'K'],
    label: 'Open command palette',
    description: 'Search routes and commitments from anywhere in the app shell.',
  },
  {
    id: 'command-palette-windows',
    area: 'Global',
    keys: ['Ctrl', 'K'],
    label: 'Open command palette',
    description: 'Windows and Linux alternative for opening the command palette.',
  },
  {
    id: 'keyboard-shortcuts',
    area: 'Global',
    keys: ['?'],
    label: 'Show keyboard shortcuts',
    description: 'Open this help overlay when focus is outside editable fields.',
  },
  {
    id: 'escape-dialog',
    area: 'Dialogs',
    keys: ['Esc'],
    label: 'Close overlay or dialog',
    description: 'Dismiss the active dialog and restore focus to the trigger.',
  },
  {
    id: 'skip-link',
    area: 'Navigation',
    keys: ['Tab', 'Enter'],
    label: 'Skip to main content',
    description: 'Focus the skip link and activate it to bypass sidebar navigation.',
  },
] as const satisfies readonly KeyboardShortcut[]

export const COMMAND_PALETTE_SHORTCUTS = KEYBOARD_SHORTCUTS.filter(
  (shortcut) => shortcut.id === 'command-palette' || shortcut.id === 'command-palette-windows',
)

export function matchesKeyboardShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut) {
  const keys = shortcut.keys.map((key) => key.toLowerCase())
  const requiresMeta = keys.includes('cmd')
  const requiresCtrl = keys.includes('ctrl')
  const requiresShift = keys.includes('shift')
  const requiresAlt = keys.includes('alt')
  const primaryKey = keys.find(
    (key) => !['cmd', 'ctrl', 'shift', 'alt'].includes(key),
  )

  return (
    Boolean(primaryKey) &&
    event.key.toLowerCase() === primaryKey &&
    event.metaKey === requiresMeta &&
    event.ctrlKey === requiresCtrl &&
    event.shiftKey === requiresShift &&
    event.altKey === requiresAlt
  )
}

export function getShortcutGroups(shortcuts: readonly KeyboardShortcut[] = KEYBOARD_SHORTCUTS) {
  return shortcuts.reduce<Record<ShortcutArea, KeyboardShortcut[]>>(
    (groups, shortcut) => {
      groups[shortcut.area].push(shortcut)
      return groups
    },
    {
      Global: [],
      Navigation: [],
      Dialogs: [],
    },
  )
}
