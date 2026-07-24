// @vitest-environment happy-dom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ResumeDraftPrompt from './ResumeDraftPrompt';
import { DraftState } from '@/hooks/useDraftPersistence';

describe('ResumeDraftPrompt', () => {
  const mockDraft: DraftState = {
    selectedType: 'balanced',
    amount: '100',
    asset: 'USDC',
    durationDays: 30,
    maxLossPercent: 5,
    step: 2,
  };

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
        addListener: vi.fn(),
        removeListener: vi.fn(),
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

  it('renders all draft information correctly in the dialog', () => {
    render(
      <ResumeDraftPrompt
        draft={mockDraft}
        onResume={vi.fn()}
        onStartFresh={vi.fn()}
      />
    );

    // Verify dialog elements exist and are correctly bound
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('resume-draft-title');
    expect(dialog.getAttribute('aria-describedby')).toBe('resume-draft-description');

    expect(screen.getByText('Resume Your Draft')).toBeInTheDocument();
    expect(screen.getByText('Balanced Commitment')).toBeInTheDocument();
    expect(screen.getByText('100 USDC')).toBeInTheDocument();
    expect(screen.getByText('30 days')).toBeInTheDocument();
    expect(screen.getByText('5%')).toBeInTheDocument();
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
  });

  it('calls onResume when clicking Resume Draft button', () => {
    const onResume = vi.fn();
    const onStartFresh = vi.fn();

    render(
      <ResumeDraftPrompt
        draft={mockDraft}
        onResume={onResume}
        onStartFresh={onStartFresh}
      />
    );

    const resumeBtn = screen.getByText('Resume Draft');
    fireEvent.click(resumeBtn);
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onStartFresh).not.toHaveBeenCalled();
  });

  it('calls onStartFresh when clicking Start Fresh button', () => {
    const onResume = vi.fn();
    const onStartFresh = vi.fn();

    render(
      <ResumeDraftPrompt
        draft={mockDraft}
        onResume={onResume}
        onStartFresh={onStartFresh}
      />
    );

    const startFreshBtn = screen.getByText('Start Fresh');
    fireEvent.click(startFreshBtn);
    expect(onStartFresh).toHaveBeenCalledTimes(1);
    expect(onResume).not.toHaveBeenCalled();
  });

  it('calls onStartFresh when clicking close icon button', () => {
    const onResume = vi.fn();
    const onStartFresh = vi.fn();

    render(
      <ResumeDraftPrompt
        draft={mockDraft}
        onResume={onResume}
        onStartFresh={onStartFresh}
      />
    );

    const closeBtn = screen.getByLabelText('Close dialog');
    fireEvent.click(closeBtn);
    expect(onStartFresh).toHaveBeenCalledTimes(1);
  });
});
