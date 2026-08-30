/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CommandPalette } from '@/components/CommandPalette/CommandPalette';
import {
  CommandPaletteProvider,
  useCommandPalette,
} from '@/components/CommandPalette/CommandPaletteProvider';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function OpenOnMount({ children }: { children: React.ReactNode }) {
  const { open } = useCommandPalette();
  React.useEffect(() => {
    open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

function renderOpenPalette() {
  return render(
    <CommandPaletteProvider>
      <OpenOnMount>
        <CommandPalette />
      </OpenOnMount>
    </CommandPaletteProvider>,
  );
}

describe('CommandPalette', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when closed', () => {
    render(
      <CommandPaletteProvider>
        <CommandPalette />
      </CommandPaletteProvider>,
    );
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('lists the static commands when open', () => {
    renderOpenPalette();
    expect(screen.getByText('Go to Analytics')).toBeTruthy();
    expect(screen.getByText('Create a commitment')).toBeTruthy();
  });

  it('filters commands as the user types', () => {
    renderOpenPalette();
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'analytics' } });

    expect(screen.getByText('Go to Analytics')).toBeTruthy();
    expect(screen.queryByText('Create a commitment')).toBeNull();
  });

  it('shows a "no matches" message when the query matches nothing', () => {
    renderOpenPalette();
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'zzz-no-match' } });
    expect(screen.getByText('No matching commands.')).toBeTruthy();
  });

  it('runs the highlighted command and closes on Enter', () => {
    const run = vi.fn();

    function WithCustomCommand() {
      const { registerCommands } = useCommandPalette();
      React.useEffect(() => {
        return registerCommands([{ id: 'custom', label: 'Custom action', run }]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <CommandPalette />;
    }

    render(
      <CommandPaletteProvider>
        <OpenOnMount>
          <WithCustomCommand />
        </OpenOnMount>
      </CommandPaletteProvider>,
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Custom action' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('runs a command when clicked', () => {
    const run = vi.fn();

    function WithCustomCommand() {
      const { registerCommands } = useCommandPalette();
      React.useEffect(() => {
        return registerCommands([{ id: 'clickable', label: 'Clickable action', run }]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <CommandPalette />;
    }

    render(
      <CommandPaletteProvider>
        <OpenOnMount>
          <WithCustomCommand />
        </OpenOnMount>
      </CommandPaletteProvider>,
    );

    fireEvent.click(screen.getByText('Clickable action'));
    expect(run).toHaveBeenCalledTimes(1);
  });
});
