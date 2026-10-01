'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { useCommandPalette } from './CommandPaletteProvider';
import type { CommandItem } from './types';

function matchesQuery(command: CommandItem, query: string): boolean {
  if (!query) return true;
  const haystack = `${command.label} ${command.group ?? ''}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

/**
 * The searchable command list UI. Reads its command set and open/close
 * state from `CommandPaletteProvider` via `useCommandPalette` -- render this
 * once near the root of the app (inside the provider) alongside per-page
 * `useRegisterCommands` calls that contribute contextual actions.
 */
export function CommandPalette() {
  const { isOpen, close, commands } = useCommandPalette();
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => commands.filter((c) => matchesQuery(c, query)), [commands, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setHighlightedIndex((current) => Math.min(current, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  if (!isOpen) return null;

  const runCommand = (command: CommandItem) => {
    if (command.disabled) return;
    command.run();
    close();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((current) => Math.min(current + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const command = filtered[highlightedIndex];
      if (command) runCommand(command);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={close}
      initialFocusRef={inputRef}
      describedById="command-palette-instructions"
      className="w-full max-w-lg rounded-2xl border border-[rgba(0,212,255,0.3)] bg-[#0a0a0b] text-white shadow-[0_0_30px_rgba(0,212,255,0.15)] overflow-hidden"
    >
      <p id="command-palette-instructions" className="sr-only">
        Type to search commands. Use the arrow keys to navigate and Enter to run a command.
      </p>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls="command-palette-list"
        aria-activedescendant={
          filtered[highlightedIndex] ? `command-${filtered[highlightedIndex].id}` : undefined
        }
        placeholder="Type a command…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full bg-transparent border-b border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
      />
      <ul id="command-palette-list" role="listbox" className="max-h-80 overflow-y-auto py-2">
        {filtered.length === 0 && (
          <li className="px-4 py-3 text-sm text-white/40" role="presentation">
            No matching commands.
          </li>
        )}
        {filtered.map((command, index) => (
          // Keyboard users never focus these <li> options directly: the input above owns
          // keyboard navigation (ArrowUp/ArrowDown/Enter) via the aria-activedescendant
          // pattern, so onClick here is a mouse-only affordance layered on top of that.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          <li
            key={command.id}
            id={`command-${command.id}`}
            role="option"
            aria-selected={index === highlightedIndex}
            aria-disabled={command.disabled}
            onMouseEnter={() => setHighlightedIndex(index)}
            onClick={() => runCommand(command)}
            className={[
              'flex items-center justify-between px-4 py-2 text-sm cursor-pointer',
              index === highlightedIndex ? 'bg-[#0ff0fc15] text-[#0ff0fc]' : 'text-white/80',
              command.disabled ? 'opacity-40 cursor-not-allowed' : '',
            ].join(' ')}
          >
            <span>{command.label}</span>
            {command.shortcut && <span className="text-xs text-white/40">{command.shortcut}</span>}
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

export default CommandPalette;
