'use client';

import { useEffect, useRef } from 'react';

/**
 * `TourStep` renders a single step in a guided tour, positioned next to a
 * target element. The keyboard handler is scoped to the component's own
 * container element (via `containerRef`) — it does **not** attach to
 * `document`, so arrow-key input in unrelated form fields (e.g. `#amount`,
 * `#duration`, `#maxLoss`) inside the same page won't accidentally trigger
 * tour navigation.
 *
 * Keyboard handling (when the container or one of its descendants has focus):
 *
 *   ArrowLeft   → onPrev
 *   ArrowRight  → onNext
 *   Escape      → onDismiss
 *
 * The container is rendered with `role="dialog"` and `tabIndex={-1}` so it
 * is focusable but not in the tab order.
 */

export interface TourStepProps {
  /** Heading for the step, announced by screen readers. */
  title: string;
  /** Optional descriptive copy. */
  description?: string;
  /** Fired when the user presses ArrowLeft inside the tour. */
  onPrev?: () => void;
  /** Fired when the user presses ArrowRight inside the tour. */
  onNext?: () => void;
  /** Fired when the user presses Escape inside the tour. */
  onDismiss?: () => void;
  /** Render the step contents (e.g. buttons, links) inside the tooltip body. */
  children?: React.ReactNode;
  /** Extra className applied to the root container. */
  className?: string;
}

function handleKey(
  event: KeyboardEvent,
  cb: { onPrev?: () => void; onNext?: () => void; onDismiss?: () => void },
): void {
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    event.stopPropagation();
    cb.onPrev?.();
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    event.stopPropagation();
    cb.onNext?.();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    cb.onDismiss?.();
  }
}

export default function TourStep({
  title,
  description,
  onPrev,
  onNext,
  onDismiss,
  children,
  className,
}: TourStepProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const onKeyDown = (event: KeyboardEvent) =>
      handleKey(event, { onPrev, onNext, onDismiss });

    // Scope the listener to the container element only. Earlier versions of
    // this component attached to `document`, which meant that typing arrow
    // keys into *any* input on the page (e.g. form fields inside the wizard)
    // inadvertently triggered tour navigation.
    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
    };
  }, [onPrev, onNext, onDismiss]);

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
      data-testid="tour-step"
      className={className}
    >
      <h2 className="tour-step__title">{title}</h2>
      {description ? (
        <p className="tour-step__description">{description}</p>
      ) : null}
      <div className="tour-step__body">{children}</div>
    </div>
  );
}