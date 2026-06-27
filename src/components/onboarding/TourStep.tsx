'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';

interface TourStepProps {
  targetSelector: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  currentStepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function TourStep({
  targetSelector,
  title,
  content,
  position = 'bottom',
  currentStepIndex,
  totalSteps,
  onNext,
  onBack,
  onSkip,
}: TourStepProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [targetFound, setTargetFound] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  // Focus management: Focus on the tooltip title/container when step changes
  useEffect(() => {
    if (containerRef.current) {
      const nextBtn = containerRef.current.querySelector('[data-testid="tour-next-btn"]') as HTMLButtonElement;
      if (nextBtn) {
        nextBtn.focus();
      } else {
        containerRef.current.focus();
      }
    }
  }, [currentStepIndex]);

  // Handle targeting, positioning, and highlighting
  useEffect(() => {
    let active = true;
    let observer: MutationObserver | null = null;
    let highlightedEl: HTMLElement | null = null;

    const updatePosition = () => {
      if (!active) return;
      const target = document.querySelector(targetSelector) as HTMLElement;

      if (!target) {
        setTargetFound(false);
        return;
      }

      setTargetFound(true);

      // Highlight target element
      if (highlightedEl && highlightedEl !== target) {
        highlightedEl.classList.remove('tour-highlighted');
      }
      highlightedEl = target;
      target.classList.add('tour-highlighted');

      // Add stylesheet rule if it doesn't exist
      if (!document.getElementById('tour-highlight-styles')) {
        const style = document.createElement('style');
        style.id = 'tour-highlight-styles';
        style.innerHTML = `
          .tour-highlighted {
            position: relative !important;
            z-index: 99999 !important;
            outline: 2px solid #0ff0fc !important;
            outline-offset: 4px !important;
            box-shadow: 0 0 16px rgba(0, 212, 255, 0.6) !important;
            transition: all 0.2s ease-in-out !important;
          }
        `;
        document.head.appendChild(style);
      }

      const rect = target.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;

      let top = 0;
      let left = 0;

      // Tooltip dimensions fallback or estimation before DOM placement
      const tooltipWidth = 320;
      const tooltipHeight = 160;

      switch (position) {
        case 'top':
          top = rect.top + scrollY - tooltipHeight - 12;
          left = rect.left + scrollX + (rect.width - tooltipWidth) / 2;
          break;
        case 'left':
          top = rect.top + scrollY + (rect.height - tooltipHeight) / 2;
          left = rect.left + scrollX - tooltipWidth - 12;
          break;
        case 'right':
          top = rect.top + scrollY + (rect.height - tooltipHeight) / 2;
          left = rect.right + scrollX + 12;
          break;
        case 'bottom':
        default:
          top = rect.bottom + scrollY + 12;
          left = rect.left + scrollX + (rect.width - tooltipWidth) / 2;
          break;
      }

      // Constrain tooltip boundaries within the screen viewport
      const padding = 16;
      left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
      
      // Calculate height dynamically if already in DOM
      if (containerRef.current) {
        const actualHeight = containerRef.current.offsetHeight;
        if (position === 'top') {
          top = rect.top + scrollY - actualHeight - 12;
        } else if (position === 'left' || position === 'right') {
          top = rect.top + scrollY + (rect.height - actualHeight) / 2;
        }
      }

      setCoords({ top, left });
    };

    updatePosition();

    // Set up ResizeObserver and Scroll listeners to update position dynamically
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    // Watch for DOM changes to find target element if it's rendered late
    observer = new MutationObserver(() => {
      updatePosition();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      active = false;
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
      if (observer) {
        observer.disconnect();
      }
      if (highlightedEl) {
        highlightedEl.classList.remove('tour-highlighted');
      }
    };
  }, [targetSelector, position]);

  // Trap focus inside the tooltip & Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentStepIndex > 0) {
          onBack();
        }
      } else if (e.key === 'Tab') {
        if (!containerRef.current) return;
        const focusable = containerRef.current.querySelectorAll(
          'button, [tabindex="0"]'
        );
        if (focusable.length === 0) return;
        const first = focusable[0] as HTMLElement;
        const last = focusable[focusable.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onNext, onBack, onSkip, currentStepIndex]);

  if (!targetFound || !coords) return null;

  const tooltipElement = (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 99999,
      }}
    >
      {/* Semi-transparent backdrop overlay to dim other content slightly */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(1px)',
          pointerEvents: 'auto',
          zIndex: 99998,
        }}
        onClick={onSkip}
        data-testid="tour-overlay"
      />

      <motion.div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
        aria-describedby="tour-step-content"
        tabIndex={-1}
        initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.95, y: position === 'top' ? 10 : -10 }}
        animate={shouldReduceMotion ? {} : { opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'absolute',
          top: coords.top,
          left: coords.left,
          width: '320px',
          backgroundColor: 'rgba(10, 10, 11, 0.95)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(0, 212, 255, 0.3)',
          borderRadius: '16px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 212, 255, 0.1)',
          color: '#ffffff',
          padding: '20px',
          pointerEvents: 'auto',
          zIndex: 99999,
        }}
        data-testid="tour-tooltip"
      >
        {/* Step Indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#0ff0fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Step {currentStepIndex + 1} of {totalSteps}
          </span>
          <button
            onClick={onSkip}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)')}
            aria-label="Skip tour"
            data-testid="tour-skip-link"
          >
            Skip Tour
          </button>
        </div>

        {/* Content */}
        <h3 id="tour-step-title" style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: '#ffffff' }}>
          {title}
        </h3>
        <p id="tour-step-content" style={{ fontSize: '13px', lineHeight: '1.5', color: 'rgba(255, 255, 255, 0.75)', marginBottom: '20px' }}>
          {content}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={onBack}
            disabled={currentStepIndex === 0}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: currentStepIndex === 0 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.8)',
              fontSize: '13px',
              fontWeight: 500,
              padding: '6px 12px',
              cursor: currentStepIndex === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (currentStepIndex > 0) {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (currentStepIndex > 0) {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            aria-label="Previous step"
            data-testid="tour-back-btn"
          >
            Back
          </button>

          <button
            onClick={onNext}
            style={{
              background: 'linear-gradient(to right, #0ff0fc, #00d4aa)',
              border: 'none',
              borderRadius: '8px',
              color: '#050a0e',
              fontSize: '13px',
              fontWeight: 600,
              padding: '6px 16px',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            aria-label={currentStepIndex === totalSteps - 1 ? 'Finish tour' : 'Next step'}
            data-testid="tour-next-btn"
          >
            {currentStepIndex === totalSteps - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(tooltipElement, document.body);
}
