export interface CommandItem {
  /** Stable, unique id. Later registrations with the same id replace earlier ones. */
  id: string;
  label: string;
  /** Optional grouping label shown as a section header in the palette list. */
  group?: string;
  /** Higher priority sorts first within its group. Defaults to 0. */
  priority?: number;
  /** Human-readable shortcut hint (e.g. "⌘K"), display-only. */
  shortcut?: string;
  /** When true, the command is shown but cannot be activated. */
  disabled?: boolean;
  disabledReason?: string;
  run: () => void;
}

export interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  /** All commands currently available: static defaults merged with registered ones, deduped by id. */
  commands: CommandItem[];
  /** Registers or replaces commands by id. Returns an unregister function for convenience. */
  registerCommands: (commands: CommandItem[]) => () => void;
  unregisterCommands: (ids: string[]) => void;
}
