import { fireEvent, render, screen, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopyButton } from '../CopyButton';

describe('CopyButton', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    vi.useRealTimers();
  });

  it('copies using the Clipboard API and announces success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<CopyButton value="GADDRESS" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy address' }));

    expect(writeText).toHaveBeenCalledWith('GADDRESS');
    expect((await screen.findByRole('status')).textContent).toBe('Copied');
  });

  it('announces failure when the Clipboard API rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Permission denied'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<CopyButton value="GADDRESS" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy address' }));

    expect((await screen.findByRole('status')).textContent).toBe('Copy failed');
  });

  it('falls back to document.execCommand when the Clipboard API is unavailable', async () => {
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });

    render(<CopyButton value="GADDRESS" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy address' }));

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect((await screen.findByRole('status')).textContent).toBe('Copied');
    expect(document.querySelector('textarea')).toBeNull();
    delete (document as Document & { execCommand?: typeof document.execCommand }).execCommand;
  });

  it('resets the confirmation after two seconds', async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    render(<CopyButton value="GADDRESS" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy address' }));
    });
    expect(screen.getByRole('status').textContent).toBe('Copied');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('clears the reset timer on unmount', async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    const { unmount } = render(<CopyButton value="GADDRESS" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy address' }));
    });
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
