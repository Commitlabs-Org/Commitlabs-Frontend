/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import TourStep from '@/components/onboarding/TourStep';

describe('TourStep keyboard handler', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    cleanup();
  });

  it('does not hijack ArrowLeft/ArrowRight fired outside its containerRef', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onDismiss = vi.fn();

    // The "external" input is a sibling of the TourStep, not inside it.
    // This is the regression case from issue #1408: arrow-key input in a
    // wizard form field (#amount / #duration / #maxLoss) was previously
    // triggering tour navigation because the handler was attached to
    // `document`.
    const { getByTestId } = render(
      <>
        <input id="amount" data-testid="external-amount" type="text" />
        <TourStep title="Pick a goal" onPrev={onPrev} onNext={onNext} onDismiss={onDismiss}>
          <p>Step content</p>
        </TourStep>
      </>,
    );

    const external = getByTestId('external-amount');
    fireEvent.keyDown(external, { key: 'ArrowLeft' });
    fireEvent.keyDown(external, { key: 'ArrowRight' });
    fireEvent.keyDown(external, { key: 'ArrowUp' });
    fireEvent.keyDown(external, { key: 'Enter' });

    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('does not hijack document-level keydown events from unrelated elements', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onDismiss = vi.fn();

    const { container } = render(
      <>
        <input id="duration" data-testid="duration" />
        <input id="maxLoss" data-testid="maxLoss" />
        <TourStep title="Pick a goal" onPrev={onPrev} onNext={onNext} onDismiss={onDismiss}>
          <p>Body</p>
        </TourStep>
      </>,
    );

    // Sanity: ensure TourStep rendered something with its container.
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    // Fire document-level keydown directly — the tour must NOT react because
    // its listener is on the container element, not on document.
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
    );
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );

    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('calls onPrev when ArrowLeft fires inside its containerRef', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const onDismiss = vi.fn();

    const { getByTestId } = render(
      <TourStep title="Pick a goal" onPrev={onPrev} onNext={onNext} onDismiss={onDismiss}>
        <button>Inner button</button>
      </TourStep>,
    );

    const container = getByTestId('tour-step');
    fireEvent.keyDown(container, { key: 'ArrowLeft' });
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('calls onNext when ArrowRight fires inside its containerRef', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    const { getByTestId } = render(
      <TourStep title="Pick a goal" onPrev={onPrev} onNext={onNext}>
        <span>Inner</span>
      </TourStep>,
    );

    fireEvent.keyDown(getByTestId('tour-step'), { key: 'ArrowRight' });
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('calls onDismiss when Escape fires inside its containerRef', () => {
    const onDismiss = vi.fn();

    const { getByTestId } = render(
      <TourStep title="Pick a goal" onDismiss={onDismiss}>
        <span>Inner</span>
      </TourStep>,
    );

    fireEvent.keyDown(getByTestId('tour-step'), { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('forwards arrow keys from descendants inside the container', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    const { getByText } = render(
      <TourStep title="Pick a goal" onPrev={onPrev} onNext={onNext}>
        <button>Inner button</button>
      </TourStep>,
    );

    // Events bubble up to the container — keyboard listener is attached to
    // the container node itself, not to a child, so descendants must bubble.
    fireEvent.keyDown(getByText('Inner button'), { key: 'ArrowRight' });
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('prevents default and stops propagation so arrow keys do not scroll the page', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    const { getByTestId } = render(
      <TourStep title="Pick a goal" onPrev={onPrev} onNext={onNext} />,
    );

    const event = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    });
    fireEvent(getByTestId('tour-step'), event);

    expect(event.defaultPrevented).toBe(true);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('cleans up its keydown listener on unmount', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    const { getByTestId, unmount } = render(
      <TourStep title="Pick a goal" onPrev={onPrev} onNext={onNext} />,
    );
    const node = getByTestId('tour-step');
    const removeSpy = vi.spyOn(node, 'removeEventListener');

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('does not attach a listener to `document`', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');

    const { unmount } = render(
      <TourStep title="Pick a goal" onPrev={vi.fn()} onNext={vi.fn()} />,
    );

    const tourListeners = addSpy.mock.calls.filter(
      ([eventName]) => eventName === 'keydown',
    );
    // If any document-level keydown listener exists, the original bug is
    // back. (allow any React-internal `focus`/`click` listeners etc.)
    expect(tourListeners).toHaveLength(0);

    unmount();
  });
});