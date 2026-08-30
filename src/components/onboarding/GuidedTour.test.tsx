/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GuidedTour, type GuidedTourStepLike } from '@/components/onboarding/GuidedTour';

const STEP: GuidedTourStepLike = {
  targetSelector: '#target',
  title: 'Step title',
  content: 'Step content',
};

function renderTour(overrides: Partial<React.ComponentProps<typeof GuidedTour>> = {}) {
  const props: React.ComponentProps<typeof GuidedTour> = {
    isActive: true,
    currentStepIndex: 0,
    currentStepConfig: STEP,
    totalSteps: 3,
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSkip: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<GuidedTour {...props} />) };
}

describe('GuidedTour', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when inactive', () => {
    renderTour({ isActive: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders nothing when there is no current step', () => {
    renderTour({ currentStepConfig: null });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders the dialog with the step title, content, and progress', () => {
    renderTour({ currentStepIndex: 1, totalSteps: 3 });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Step title')).toBeTruthy();
    expect(screen.getByText('Step content')).toBeTruthy();
    expect(screen.getByText('Step 2 of 3')).toBeTruthy();
  });

  it('hides the Back button on the first step', () => {
    renderTour({ currentStepIndex: 0 });
    expect(screen.queryByTestId('tour-back')).toBeNull();
  });

  it('shows the Back button after the first step and calls onBack', () => {
    const { props } = renderTour({ currentStepIndex: 1 });
    const backButton = screen.getByTestId('tour-back');
    fireEvent.click(backButton);
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it('labels the last step\'s advance button "Finish"', () => {
    renderTour({ currentStepIndex: 2, totalSteps: 3 });
    expect(screen.getByTestId('tour-next').textContent).toBe('Finish');
  });

  it('labels a non-final step\'s advance button "Next" and calls onNext', () => {
    const { props } = renderTour({ currentStepIndex: 0, totalSteps: 3 });
    const nextButton = screen.getByTestId('tour-next');
    expect(nextButton.textContent).toBe('Next');
    fireEvent.click(nextButton);
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it('calls onSkip when "Skip tour" is clicked', () => {
    const { props } = renderTour();
    fireEvent.click(screen.getByTestId('tour-skip'));
    expect(props.onSkip).toHaveBeenCalledTimes(1);
  });

  it('scrolls the target element into view when "Show me on the page" is clicked', () => {
    const target = document.createElement('div');
    target.id = 'target';
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;
    document.body.appendChild(target);

    renderTour();
    fireEvent.click(screen.getByText('Show me on the page'));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });

    document.body.removeChild(target);
  });
});
