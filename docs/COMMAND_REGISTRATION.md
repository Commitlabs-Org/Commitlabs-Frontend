# Command Palette: Per-Page Command Registration

The command palette (`Cmd/Ctrl+K`) starts with a small static set of navigation
commands. Pages and components can contribute their own contextual commands
-- shown only while that page/component is mounted -- via `useRegisterCommands`.

## Architecture

- **`CommandPaletteProvider`** (`src/components/CommandPalette/CommandPaletteProvider.tsx`)
  Holds open/close state, the static command list, and a registry
  (`Map<id, CommandItem>`) of dynamically-registered commands. Merges both
  sets (deduped by id, dynamic wins on collision) into the `commands` array
  exposed via context. Wrap the app in this provider once, near the root.
- **`CommandPalette`** (`src/components/CommandPalette/CommandPalette.tsx`)
  The searchable list UI. Reads `isOpen`/`commands` from the provider; render
  it once alongside the provider.
- **`useRegisterCommands(commands)`**
  Registers `commands` on mount and unregisters them on unmount.

## Usage

```tsx
import { useRegisterCommands, type CommandItem } from '@/components/CommandPalette';

function SomePage() {
  const router = useRouter();

  const commands: CommandItem[] = useMemo(
    () => [
      {
        id: 'page:some-action',
        label: 'Do the thing',
        group: 'This Page',
        run: () => doTheThing(),
      },
    ],
    [],
  );

  useRegisterCommands(commands);
  // ...
}
```

## API

```ts
interface CommandItem {
  id: string;            // stable, unique; later registrations with the same id win
  label: string;
  group?: string;         // section header in the palette list
  priority?: number;      // higher sorts first within its group (default 0)
  shortcut?: string;      // display-only hint, e.g. "⌘K"
  disabled?: boolean;
  disabledReason?: string;
  run: () => void;
}

useRegisterCommands(commands: CommandItem[]): void
```

## Re-registration behavior

`useRegisterCommands` re-registers only when the **set of ids** in `commands`
changes, not on every render -- so passing a fresh (non-memoized) array each
render is safe and will not cause a register/unregister loop. This means
changing a command's `label` or `run` in place, without changing its `id`,
will not take effect until the id set changes. If a command's behavior needs
to change based on page state, give it a new id (or memoize the array with
`useMemo` and include that state in the dependency list) rather than mutating
in place.

## Accessibility

- The palette input has `role="combobox"` with `aria-expanded`,
  `aria-controls`, and `aria-activedescendant` pointing at the highlighted
  option -- keyboard users navigate entirely from the input (`ArrowUp` /
  `ArrowDown` / `Enter`); no need to tab into the list itself.
- The dialog itself (via the shared `Dialog` primitive) traps focus, closes
  on `Escape`, and marks the rest of the page `inert` while open.
- Disabled commands are marked `aria-disabled` and are not activatable.

## Testing

See `src/components/CommandPalette/useRegisterCommands.test.tsx` (registration
lifecycle: mount/unmount, id-based dedupe, multiple simultaneous registrants)
and `src/components/CommandPalette/CommandPalette.test.tsx` (rendering,
filtering, keyboard/mouse activation).
