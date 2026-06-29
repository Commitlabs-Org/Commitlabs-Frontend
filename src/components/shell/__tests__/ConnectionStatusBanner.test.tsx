// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ConnectionStatusBanner } from '../ConnectionStatusBanner';

describe('ConnectionStatusBanner', () => {
  const setOnline = (value: boolean) => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value,
    });
  };

  beforeEach(() => {
    setOnline(true);
  });

  afterEach(() => {
    setOnline(true);
  });

  it('renders nothing when online on initial mount', () => {
    const { container } = render(<ConnectionStatusBanner isOnline={true} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders an offline banner with an accessible status role', () => {
    render(<ConnectionStatusBanner isOnline={false} />);

    expect(screen.getByRole('status')).toHaveTextContent(/offline/i);
    expect(screen.getAllByText(/queued actions/i).length).toBeGreaterThan(0);
  });

  it('renders the offline banner on initial offline load', () => {
    render(<ConnectionStatusBanner isOnline={false} />);

    expect(screen.getByRole('status')).toHaveTextContent(/you are offline/i);
  });

  it('shows a reconnect confirmation when the app comes back online after being offline', () => {
    const { rerender } = render(<ConnectionStatusBanner isOnline={false} />);

    // Simulate window online event to update navigator.onLine
    setOnline(true);
    window.dispatchEvent(new Event('online'));

    rerender(<ConnectionStatusBanner isOnline={true} />);

    expect(screen.getByRole('status')).toHaveTextContent(/back online/i);
  });

  it('does not show reconnect on initial online mount (no prior offline state)', () => {
    const { container } = render(<ConnectionStatusBanner isOnline={true} />);

    expect(container.firstChild).toBeNull();
  });

  it('hides the offline banner when dismissed', () => {
    const { container, rerender } = render(
      <ConnectionStatusBanner isOnline={false} />,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));

    rerender(<ConnectionStatusBanner isOnline={false} />);

    expect(container.firstChild).toBeNull();
  });

  it('shows reconnect after coming back online even if previously dismissed', () => {
    const { container, rerender } = render(
      <ConnectionStatusBanner isOnline={false} />,
    );

    // Dismiss while offline
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    rerender(<ConnectionStatusBanner isOnline={false} />);
    expect(container.firstChild).toBeNull();

    // Come back online
    setOnline(true);
    window.dispatchEvent(new Event('online'));
    rerender(<ConnectionStatusBanner isOnline={true} />);

    expect(screen.getByRole('status')).toHaveTextContent(/back online/i);
  });
});
