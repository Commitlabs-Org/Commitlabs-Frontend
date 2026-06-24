"use client";

import React, {
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

let scrollLockCount = 0;
let previousBodyOverflow = "";

function lockBodyScroll() {
  if (scrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLockCount += 1;
}

function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
    previousBodyOverflow = "";
  }
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.tabIndex !== -1,
  );
}

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  dismissible?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
  backdropClassName?: string;
  panelClassName?: string;
  contentClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  closeButtonClassName?: string;
  closeIcon?: ReactNode;
  closeLabel?: string;
  showCloseButton?: boolean;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  dismissible = true,
  initialFocusRef,
  backdropClassName = "fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300",
  panelClassName = "relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#0A0A0A] text-white shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-bottom-8 motion-safe:duration-500",
  contentClassName = "",
  titleClassName = "text-2xl font-bold text-white",
  descriptionClassName = "text-sm text-white/60",
  closeButtonClassName = "absolute right-6 top-6 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white",
  closeIcon = "×",
  closeLabel,
  showCloseButton = true,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!isOpen || !mounted) return;

    if (!title && process.env.NODE_ENV !== "production") {
      throw new Error("Dialog requires a title for aria-labelledby.");
    }

    previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    lockBodyScroll();

    const focusTimer = window.setTimeout(() => {
      const focusTarget =
        initialFocusRef?.current ??
        getFocusableElements(panelRef.current)[0] ??
        panelRef.current;
      focusTarget?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = getFocusableElements(panelRef.current);
      if (focusableElements.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      unlockBodyScroll();
      const previousActiveElement = previousActiveElementRef.current;
      if (previousActiveElement && document.contains(previousActiveElement)) {
        previousActiveElement.focus();
      } else {
        document.body.focus();
      }
    };
  }, [dismissible, initialFocusRef, isOpen, mounted, onClose, title]);

  if (!isOpen || !mounted) return null;

  const titleText = typeof title === "string" ? title : "dialog";
  const titleAlreadyNamesDialog = /\bdialog$/i.test(titleText);
  const accessibleCloseLabel =
    closeLabel ?? `Close ${titleText}${titleAlreadyNamesDialog ? "" : " dialog"}`;

  return createPortal(
    <div
      className={backdropClassName}
      onClick={(event) => {
        if (dismissible && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={panelClassName}
        role="dialog"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {showCloseButton && dismissible ? (
          <button
            type="button"
            aria-label={accessibleCloseLabel}
            className={closeButtonClassName}
            onClick={onClose}
          >
            {closeIcon}
          </button>
        ) : null}

        <div className={contentClassName}>
          <div className="sr-only">
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <div aria-hidden="true" className="hidden">
            <h2 className={titleClassName}>{title}</h2>
            {description ? <p className={descriptionClassName}>{description}</p> : null}
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default Dialog;
