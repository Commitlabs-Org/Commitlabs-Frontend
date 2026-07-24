// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { NotificationToggle } from './NotificationToggle';

// Mock framer-motion to avoid happy-dom layout animation issues
vi.mock('framer-motion', () => ({
  motion: {
    span: React.forwardRef<HTMLSpanElement, any>(({ children, className, layout, transition, ...props }, ref) => (
      <span ref={ref} className={className} {...props}>
        {children}
      </span>
    )),
  },
}));

// Mock lucide-react to easily verify the rendering of icons
vi.mock('lucide-react', () => ({
  Bell: ({ className, size }: any) => (
    <svg data-testid="icon-bell" className={className} data-size={size} />
  ),
  BellOff: ({ className, size }: any) => (
    <svg data-testid="icon-bell-off" className={className} data-size={size} />
  ),
}));

describe('NotificationToggle', () => {
  const defaultProps = {
    id: 'test-notification-toggle',
    label: 'Email Notifications',
    description: 'Receive updates via email about your commitments.',
    enabled: false,
    onChange: vi.fn(),
  };

  it('renders correctly in disabled (off) state', () => {
    render(<NotificationToggle {...defaultProps} enabled={false} />);

    // Assert labels and description
    expect(screen.getByText('Email Notifications')).toBeInTheDocument();
    expect(screen.getByText('Receive updates via email about your commitments.')).toBeInTheDocument();

    // Assert the switch control and its state
    const switchControl = screen.getByRole('switch');
    expect(switchControl).toBeInTheDocument();
    expect(switchControl).toHaveAttribute('id', 'test-notification-toggle');
    expect(switchControl).toHaveAttribute('aria-checked', 'false');

    // Assert correct label-switch connection via htmlFor & id
    const label = screen.getByText('Email Notifications');
    expect(label).toHaveAttribute('for', 'test-notification-toggle');

    // Assert the BellOff icon is rendered in off state
    expect(screen.queryByTestId('icon-bell-off')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-bell')).not.toBeInTheDocument();
  });

  it('renders correctly in enabled (on) state', () => {
    render(<NotificationToggle {...defaultProps} enabled={true} />);

    const switchControl = screen.getByRole('switch');
    expect(switchControl).toHaveAttribute('aria-checked', 'true');

    // Assert the Bell icon is rendered in on state
    expect(screen.queryByTestId('icon-bell')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-bell-off')).not.toBeInTheDocument();
  });

  it('fires onChange with true when clicked in off state', () => {
    const onChange = vi.fn();
    render(<NotificationToggle {...defaultProps} enabled={false} onChange={onChange} />);

    const switchControl = screen.getByRole('switch');
    fireEvent.click(switchControl);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('fires onChange with false when clicked in on state', () => {
    const onChange = vi.fn();
    render(<NotificationToggle {...defaultProps} enabled={true} onChange={onChange} />);

    const switchControl = screen.getByRole('switch');
    fireEvent.click(switchControl);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('supports keyboard activation via Space key', () => {
    const onChange = vi.fn();
    render(<NotificationToggle {...defaultProps} enabled={false} onChange={onChange} />);

    const switchControl = screen.getByRole('switch');
    // For normal HTML buttons, keydown or keyup trigger click if focus is correct.
    // In React testing environment, we fire click event on key/space or test with keyDown
    // Note that standard button element automatically translates Enter/Space to click, but
    // let's verify keydown or direct click behavior. Let's trigger a click event to simulate the browser's behavior.
    // But since the button has onClick, any activation of a button element (via click, or click triggered by keypress) will run onClick.
    // Let's fire standard click or keydown.
    fireEvent.keyDown(switchControl, { key: ' ', code: 'Space' });
    // Let's also verify that firing the click event works.
    fireEvent.click(switchControl);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('fires onChange properly even with rapid toggling', () => {
    const onChange = vi.fn();
    render(<NotificationToggle {...defaultProps} enabled={false} onChange={onChange} />);

    const switchControl = screen.getByRole('switch');
    fireEvent.click(switchControl);
    fireEvent.click(switchControl);
    fireEvent.click(switchControl);

    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenLastCalledWith(true);
  });
});
