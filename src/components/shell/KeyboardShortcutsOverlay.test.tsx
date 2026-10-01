/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { KeyboardShortcutsOverlay } from '@/components/shell/KeyboardShortcutsOverlay';

describe('KeyboardShortcutsOverlay', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing initially', () => {
    render(<KeyboardShortcutsOverlay />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens when "?" is pressed and nothing is focused', () => {
    render(<KeyboardShortcutsOverlay />);
    document.body.focus();

    fireEvent.keyDown(window, { key: '?' });

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Keyboard shortcuts')).toBeTruthy();
  });

  it('ignores "?" while an <input> is focused', () => {
    render(
      <>
        <input aria-label="Some field" />
        <KeyboardShortcutsOverlay />
      </>,
    );

    const input = screen.getByLabelText('Some field');
    input.focus();
    fireEvent.keyDown(input, { key: '?' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ignores "?" while a <textarea> is focused', () => {
    render(
      <>
        <textarea aria-label="Notes" />
        <KeyboardShortcutsOverlay />
      </>,
    );

    const textarea = screen.getByLabelText('Notes');
    textarea.focus();
    fireEvent.keyDown(textarea, { key: '?' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ignores "?" while a contenteditable element is focused', () => {
    render(
      <>
        <div contentEditable data-testid="editable" />
        <KeyboardShortcutsOverlay />
      </>,
    );

    const editable = screen.getByTestId('editable');
    editable.focus();
    fireEvent.keyDown(editable, { key: '?' });

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes on Escape', () => {
    render(<KeyboardShortcutsOverlay />);
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes via the Close button', () => {
    render(<KeyboardShortcutsOverlay />);
    fireEvent.keyDown(window, { key: '?' });

    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('restores focus to the previously-focused element on close', async () => {
    render(
      <>
        <button data-testid="trigger">Trigger</button>
        <KeyboardShortcutsOverlay />
      </>,
    );

    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.keyDown(window, { key: '?' });
    // Dialog moves focus inside itself asynchronously (a short setTimeout).
    await waitFor(() => expect(document.activeElement).not.toBe(trigger));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(trigger);
  });

  it('renders shortcuts grouped by section', () => {
    render(<KeyboardShortcutsOverlay />);
    fireEvent.keyDown(window, { key: '?' });

    expect(screen.getByRole('region', { name: 'Navigation' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Dialogs' })).toBeTruthy();
    expect(screen.getByText('Open the command palette')).toBeTruthy();
    expect(screen.getByText('Close the open dialog or overlay')).toBeTruthy();
  });
});
