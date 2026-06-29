// @vitest-environment happy-dom

import React, { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Dialog } from '@/components/ui/Dialog';

describe('Dialog Primitive', () => {
  beforeEach(() => {
    // Reset body style
    document.body.style.overflow = '';
    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
  });

  it('renders role="dialog", aria-modal="true", and passes ARIA IDs', () => {
    render(
      <Dialog isOpen={true} onClose={vi.fn()} labelledById="title" describedById="desc">
        <div id="title">Title</div>
        <div id="desc">Desc</div>
      </Dialog>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('title');
    expect(dialog.getAttribute('aria-describedby')).toBe('desc');
  });

  it('does not render when isOpen is false', () => {
    render(
      <Dialog isOpen={false} onClose={vi.fn()}>
        <div>Content</div>
      </Dialog>
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('locks scroll by setting overflow hidden on body, and restores it on close', () => {
    document.body.style.overflow = 'auto'; // Initial
    
    const { rerender } = render(
      <Dialog isOpen={true} onClose={vi.fn()}>
        Content
      </Dialog>
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Dialog isOpen={false} onClose={vi.fn()}>
        Content
      </Dialog>
    );

    expect(document.body.style.overflow).toBe('auto');
  });

  it('sets inert and aria-hidden on other body children while open', () => {
    const sibling = document.createElement('div');
    sibling.textContent = 'Sibling content';
    document.body.appendChild(sibling);

    const { rerender } = render(
      <Dialog isOpen={true} onClose={vi.fn()}>
        Content
      </Dialog>
    );

    expect(sibling.hasAttribute('inert')).toBe(true);
    expect(sibling.getAttribute('aria-hidden')).toBe('true');

    rerender(
      <Dialog isOpen={false} onClose={vi.fn()}>
        Content
      </Dialog>
    );

    expect(sibling.hasAttribute('inert')).toBe(false);
    expect(sibling.hasAttribute('aria-hidden')).toBe(false);
    
    document.body.removeChild(sibling);
  });

  it('calls onClose when clicking the backdrop, but not when clicking the panel', () => {
    const onClose = vi.fn();
    render(
      <Dialog isOpen={true} onClose={onClose}>
        <button>Inside Panel</button>
      </Dialog>
    );

    // The backdrop is the element with role="presentation"
    const backdrop = screen.getByRole('presentation');
    const dialog = screen.getByRole('dialog');

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(
      <Dialog isOpen={true} onClose={onClose}>
        Content
      </Dialog>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when Escape is pressed and closeOnEscape is false', () => {
    const onClose = vi.fn();
    render(
      <Dialog isOpen={true} onClose={onClose} closeOnEscape={false}>
        Content
      </Dialog>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('focuses the initialFocusRef if provided on mount', () => {
    vi.useFakeTimers();
    
    const Wrapper = () => {
      const btnRef = useRef<HTMLButtonElement>(null);
      return (
        <Dialog isOpen={true} onClose={vi.fn()} initialFocusRef={btnRef}>
          <button>A</button>
          <button ref={btnRef}>B</button>
        </Dialog>
      );
    };

    render(<Wrapper />);
    
    vi.advanceTimersByTime(100);
    
    expect(document.activeElement?.textContent).toBe('B');
    
    vi.useRealTimers();
  });

  it('falls back to the first focusable element if initialFocusRef is not provided', () => {
    vi.useFakeTimers();
    
    render(
      <Dialog isOpen={true} onClose={vi.fn()}>
        <button>A</button>
        <button>B</button>
      </Dialog>
    );
    
    vi.advanceTimersByTime(100);
    
    expect(document.activeElement?.textContent).toBe('A');
    
    vi.useRealTimers();
  });

  it('traps focus (Tab cycles forward, Shift+Tab cycles backward)', () => {
    render(
      <Dialog isOpen={true} onClose={vi.fn()}>
        <button>First</button>
        <button>Second</button>
        <button>Third</button>
      </Dialog>
    );

    const first = screen.getByText('First');
    const third = screen.getByText('Third');

    // Simulate focus on the last element
    third.focus();
    expect(document.activeElement).toBe(third);

    // Tab from last element should wrap to first
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(first);

    // Shift+Tab from first element should wrap to last
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(third);
  });

  it('restores focus to the element that was active before opening', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Trigger';
    document.body.appendChild(trigger);
    
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { rerender } = render(
      <Dialog isOpen={true} onClose={vi.fn()}>
        <button>Inside</button>
      </Dialog>
    );

    rerender(
      <Dialog isOpen={false} onClose={vi.fn()}>
        <button>Inside</button>
      </Dialog>
    );

    expect(document.activeElement).toBe(trigger);
    
    document.body.removeChild(trigger);
  });

  it('omits animation classes when prefers-reduced-motion is true', () => {
    // Override matchMedia for this test
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: true, // prefers reduced motion
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    render(
      <Dialog isOpen={true} onClose={vi.fn()}>
        Content
      </Dialog>
    );

    const backdrop = screen.getByRole('presentation');
    const dialog = screen.getByRole('dialog');

    expect(backdrop.className).not.toContain('animate-in');
    expect(dialog.className).not.toContain('animate-in');
  });

  it('should have no accessibility violations when open', async () => {
    render(
      <Dialog isOpen={true} onClose={vi.fn()} labelledById="title" describedById="desc">
        <h2 id="title">Dialog Title</h2>
        <p id="desc">Dialog Description</p>
      </Dialog>
    );
    const results = await axe(document.body);
    expect(results).toHaveNoViolations();
  });
});
