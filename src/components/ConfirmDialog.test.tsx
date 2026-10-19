import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

function Harness({ onConfirm = () => {}, pending = false }: { onConfirm?: () => void; pending?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Trigger</button>
      <ConfirmDialog
        open={open}
        title="Exit early?"
        description="This cannot be undone."
        confirmLabel="Exit"
        pending={pending}
        onConfirm={onConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

describe('ConfirmDialog', () => {
  it('opens labelled by its title and focuses the cancel action', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('Trigger'));
    const dlg = screen.getByRole('dialog', { name: 'Exit early?' });
    expect(dlg).toHaveProperty('open', true);
    expect(dlg.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('cycles focus with Tab and Shift+Tab', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('Trigger'));
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const exit = screen.getByRole('button', { name: 'Exit' });
    await user.tab();
    expect(document.activeElement).toBe(exit);
    await user.tab();
    expect(document.activeElement).toBe(cancel);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(exit);
  });

  it('cancels on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByText('Trigger');
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(document.querySelector('dialog')).toHaveProperty('open', false);
    expect(document.activeElement).toBe(trigger);
  });

  it('fires confirm once even on double click', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await user.click(screen.getByText('Trigger'));
    await user.dblClick(screen.getByRole('button', { name: 'Exit' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables buttons while pending', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<Harness pending onConfirm={onConfirm} />);
    await user.click(screen.getByText('Trigger'));
    const buttons = screen.getAllByRole('button', { hidden: true }).filter((b) => b.closest('dialog'));
    expect(buttons).toHaveLength(2);
    buttons.forEach((b) => expect(b).toHaveProperty('disabled', true));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
