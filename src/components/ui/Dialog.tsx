'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  labelledById?: string;
  describedById?: string;
  closeOnEscape?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
  backdropClassName?: string;
}

export function Dialog({
  isOpen,
  onClose,
  labelledById,
  describedById,
  closeOnEscape = true,
  initialFocusRef,
  children,
  className = '',
  backdropClassName = 'bg-black/80 p-4 backdrop-blur-md',
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => {
      setMounted(false);
      mediaQuery.removeEventListener('change', listener);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Capture previous focus
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (closeOnEscape) {
          event.preventDefault();
          onClose();
        }
        return;
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = focusableElements[0] as HTMLElement | undefined;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement | undefined;
        if (!firstElement || !lastElement) return;

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    const focusTimer = window.setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
          (focusableElements[0] as HTMLElement | undefined)?.focus();
        } else {
          dialogRef.current.focus();
        }
      }
    }, 100);

    document.addEventListener('keydown', handleKeyDown);
    
    // Scroll lock and inert implementation
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    // Make sibling root elements inert for accessibility
    const rootElements = Array.from(document.body.children).filter(
      (child) => 
        child.tagName !== 'SCRIPT' && 
        child.tagName !== 'NOSCRIPT' && 
        !child.hasAttribute('data-dialog-portal')
    );
    
    rootElements.forEach((el) => {
      el.setAttribute('inert', '');
      el.setAttribute('aria-hidden', 'true');
    });

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      
      rootElements.forEach((el) => {
        el.removeAttribute('inert');
        el.removeAttribute('aria-hidden');
      });

      // Restore focus
      if (previousFocusRef.current && document.body.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, onClose, closeOnEscape, initialFocusRef]);

  if (!isOpen || !mounted) return null;

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const animationClasses = prefersReducedMotion ? '' : 'animate-in fade-in duration-300';
  const slideClasses = prefersReducedMotion ? '' : 'animate-in slide-in-from-bottom-8 duration-500 ease-out';

  // We trim the classes in case some are empty to avoid stray spaces, 
  // though it's technically fine if they have spaces.
  const finalBackdropClass = `fixed inset-0 z-[9999] flex items-center justify-center ${backdropClassName} ${animationClasses}`.trim();
  const finalPanelClass = `${slideClasses} ${className}`.trim();

  return createPortal(
    <div
      data-dialog-portal
      data-testid="dialog-backdrop"
      className={finalBackdropClass}
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledById}
        aria-describedby={describedById}
        tabIndex={-1}
        className={finalPanelClass}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
