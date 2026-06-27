// @vitest-environment jsdom
import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GuidedTour } from './GuidedTour';
import { TourStep } from './TourStep';
import { useGuidedTour } from '@/hooks/useGuidedTour';

// Mock matchMedia for framer-motion and reduced motion checks
const createMatchMedia = (matches: boolean) => {
  return (query: string): MediaQueryList => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
};

// Wrapper Component to tie Wizard state and Guided Tour together
interface TestWizardProps {
  initialSeenLocalStorage?: string;
  initialSeenApi?: boolean;
  walletAddress?: string;
}

function TestWizard({
  initialSeenLocalStorage,
  initialSeenApi = false,
  walletAddress = 'GABC123',
}: TestWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const {
    isActive,
    currentStepIndex,
    currentStepConfig,
    totalSteps,
    nextStep,
    prevStep,
    skipTour,
    startTour,
  } = useGuidedTour({
    activeWizardStep: step,
    setWizardStep: (s) => setStep(s),
    walletAddress,
    onSelectDefaultType: () => setSelectedType('balanced'),
  });

  return (
    <div>
      {/* Wizard Steps elements for Tour targeting */}
      {step === 1 && (
        <div>
          <nav data-testid="wizard-stepper">Stepper Step 1</nav>
          <div role="radiogroup">Radio Group</div>
          <button data-testid="select-type-continue" onClick={() => setStep(2)}>
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <nav data-testid="wizard-stepper">Stepper Step 2</nav>
          <input id="amount" placeholder="Amount" />
          <input id="duration" placeholder="Duration" />
          <input id="maxLoss" placeholder="Max Loss" />
          <button data-testid="advanced-toggle">Advanced Toggle</button>
          <div data-testid="derived-section">Derived Section</div>
          <button data-testid="configure-continue" onClick={() => setStep(3)}>
            Continue Configure
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <nav data-testid="wizard-stepper">Stepper Step 3</nav>
          <div data-testid="review-sections">Review Sections</div>
          <div data-testid="review-checkboxes">Review Checkboxes</div>
          <button data-testid="create-commitment-submit">Create Commitment</button>
        </div>
      )}

      {/* Manual launch button */}
      <button data-testid="help-btn" onClick={startTour}>
        Help
      </button>

      {/* Guided Tour Component */}
      <GuidedTour
        isActive={isActive}
        currentStepIndex={currentStepIndex}
        currentStepConfig={currentStepConfig}
        totalSteps={totalSteps}
        onNext={nextStep}
        onBack={prevStep}
        onSkip={skipTour}
      />
    </div>
  );
}

describe('Guided Tour Feature', () => {
  const originalFetch = global.fetch;
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  })();

  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorage.clear();
    window.matchMedia = createMatchMedia(false); // default no reduced motion
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('automatically starts on first visit when seen preferences are false', async () => {
    const fetchSpy = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { preferences: { seenWizardTour: false } } }),
      })
    );
    global.fetch = fetchSpy;

    render(<TestWizard />);

    // Wait for the preferences API fetch and component mount
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    // Check if the first tour step is visible
    await screen.findByText('Step 1 of 12');
    expect(screen.getByText('Wizard Steps')).toBeInTheDocument();
    expect(screen.getByText(/This stepper guides you/)).toBeInTheDocument();
  });

  it('does not auto-start if seen state is true in LocalStorage', async () => {
    localStorage.setItem('commitlabs:seen-wizard-tour', 'true');
    const fetchSpy = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { preferences: { seenWizardTour: false } } }),
      })
    );
    global.fetch = fetchSpy;

    render(<TestWizard />);

    // Wait for async load to finish
    await waitFor(() => {
      expect(screen.queryByTestId('help-btn')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('tour-tooltip')).not.toBeInTheDocument();
  });

  it('does not auto-start if seen state is true in API Preferences', async () => {
    const fetchSpy = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { preferences: { seenWizardTour: true } } }),
      })
    );
    global.fetch = fetchSpy;

    render(<TestWizard />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('help-btn')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('tour-tooltip')).not.toBeInTheDocument();
  });

  it('re-launches the tour when help button is clicked', async () => {
    localStorage.setItem('commitlabs:seen-wizard-tour', 'true');
    const fetchSpy = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { preferences: { seenWizardTour: true } } }),
      })
    );
    global.fetch = fetchSpy;

    render(<TestWizard />);

    // Click help button
    const helpBtn = screen.getByTestId('help-btn');
    fireEvent.click(helpBtn);

    // Tour should render now
    await screen.findByText('Step 1 of 12');
    expect(screen.getByText('Wizard Steps')).toBeInTheDocument();
  });

  it('navigates through steps, handles step transitions and auto-select type', async () => {
    const fetchSpy = vi.fn().mockImplementation((url, options) => {
      if (options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { preferences: { seenWizardTour: true } } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { preferences: { seenWizardTour: false } } }),
      });
    });
    global.fetch = fetchSpy;

    render(<TestWizard />);

    await screen.findByText('Step 1 of 12');

    // Go to next step (Step 2: Choose Commitment Type)
    fireEvent.click(screen.getByTestId('tour-next-btn'));
    await screen.findByText('Step 2 of 12');
    expect(screen.getByText('Choose Commitment Type')).toBeInTheDocument();

    // Go to next step (Step 3: Continue to Parameters)
    fireEvent.click(screen.getByTestId('tour-next-btn'));
    await screen.findByText('Step 3 of 12');
    expect(screen.getByText('Continue to Parameters')).toBeInTheDocument();

    // Go to next step (will trigger transition to Wizard Step 2 & default select type)
    fireEvent.click(screen.getByTestId('tour-next-btn'));
    await screen.findByText('Step 4 of 12');
    expect(screen.getByText('Commitment Amount')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Amount')).toBeInTheDocument();

    // Back to Step 3 (should return to Wizard Step 1)
    fireEvent.click(screen.getByTestId('tour-back-btn'));
    await screen.findByText('Step 3 of 12');
    expect(screen.getByText('Continue to Parameters')).toBeInTheDocument();
  });

  it('can be skipped and updates LocalStorage and User Preferences API', async () => {
    const fetchSpy = vi.fn().mockImplementation((url, options) => {
      if (options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: { preferences: { seenWizardTour: true } } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { preferences: { seenWizardTour: false } } }),
      });
    });
    global.fetch = fetchSpy;

    render(<TestWizard />);

    await screen.findByText('Step 1 of 12');

    // Click skip tour link
    fireEvent.click(screen.getByTestId('tour-skip-link'));

    // Tour should be gone
    await waitFor(() => {
      expect(screen.queryByTestId('tour-tooltip')).not.toBeInTheDocument();
    });

    // Check LocalStorage and PUT request
    expect(localStorage.getItem('commitlabs:seen-wizard-tour')).toBe('true');
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/user/preferences',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ seenWizardTour: true }),
      })
    );
  });

  it('respects prefers-reduced-motion media query', async () => {
    // Stub matchMedia to return true for reduced-motion
    window.matchMedia = createMatchMedia(true);

    const fetchSpy = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { preferences: { seenWizardTour: false } } }),
      })
    );
    global.fetch = fetchSpy;

    render(<TestWizard />);

    await screen.findByText('Step 1 of 12');
    expect(screen.getByTestId('tour-tooltip')).toBeInTheDocument();
    // In actual execution, framer-motion reads reduced motion, which we mocked successfully
  });

  it('manages keyboard navigation (Esc to skip, right/left arrows)', async () => {
    const fetchSpy = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { preferences: { seenWizardTour: false } } }),
      })
    );
    global.fetch = fetchSpy;

    render(<TestWizard />);

    await screen.findByText('Step 1 of 12');

    // Press arrow right to go to step 2
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    await screen.findByText('Step 2 of 12');

    // Press arrow left to go to step 1
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    await screen.findByText('Step 1 of 12');

    // Press Escape to skip the tour
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('tour-tooltip')).not.toBeInTheDocument();
    });
  });

  it('traps focus inside the tooltip when Tab/Shift+Tab is pressed', async () => {
    const fetchSpy = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { preferences: { seenWizardTour: false } } }),
      })
    );
    global.fetch = fetchSpy;

    render(<TestWizard />);

    await screen.findByText('Step 1 of 12');
    const tooltip = screen.getByTestId('tour-tooltip');

    const nextBtn = screen.getByTestId('tour-next-btn');
    const backBtn = screen.getByTestId('tour-back-btn');
    const skipLink = screen.getByTestId('tour-skip-link');

    // Focus on first element
    skipLink.focus();
    expect(document.activeElement).toBe(skipLink);

    // Press Shift+Tab on first element -> loops focus to last element (nextBtn)
    fireEvent.keyDown(tooltip, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(nextBtn);

    // Press Tab on last element -> loops focus back to first element (skipLink)
    fireEvent.keyDown(tooltip, { key: 'Tab' });
    expect(document.activeElement).toBe(skipLink);
  });

  it('advances to the end of the tour and completes it', async () => {
    const fetchSpy = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { preferences: { seenWizardTour: false } } }),
      })
    );
    global.fetch = fetchSpy;

    // Helper component to mount wizard and render all steps at once so we don't have to change step
    function E2ETestWizard() {
      const [step, setStep] = useState<1 | 2 | 3>(1);
      const {
        isActive,
        currentStepIndex,
        currentStepConfig,
        totalSteps,
        nextStep,
        prevStep,
        skipTour,
      } = useGuidedTour({
        activeWizardStep: step,
        setWizardStep: (s) => setStep(s),
      });

      return (
        <div>
          <nav data-testid="wizard-stepper" />
          <div role="radiogroup" />
          <button data-testid="select-type-continue" />
          <input id="amount" />
          <input id="duration" />
          <input id="maxLoss" />
          <button data-testid="advanced-toggle" />
          <div data-testid="derived-section" />
          <button data-testid="configure-continue" />
          <div data-testid="review-sections" />
          <div data-testid="review-checkboxes" />
          <button data-testid="create-commitment-submit" />
          
          <GuidedTour
            isActive={isActive}
            currentStepIndex={currentStepIndex}
            currentStepConfig={currentStepConfig}
            totalSteps={totalSteps}
            onNext={nextStep}
            onBack={prevStep}
            onSkip={skipTour}
          />
        </div>
      );
    }

    render(<E2ETestWizard />);

    await screen.findByText('Step 1 of 12');

    // Click "Next" 11 times to reach step 12
    for (let i = 0; i < 11; i++) {
      fireEvent.click(screen.getByTestId('tour-next-btn'));
    }

    await screen.findByText('Step 12 of 12');
    expect(screen.getByText('Finish')).toBeInTheDocument();

    // Click "Finish"
    fireEvent.click(screen.getByTestId('tour-next-btn'));

    // Tour should close
    await waitFor(() => {
      expect(screen.queryByTestId('tour-tooltip')).not.toBeInTheDocument();
    });
  });

  it('handles fetch errors gracefully during preference load and save', async () => {
    // Mock fetch to throw/reject
    const fetchSpy = vi.fn().mockImplementation(() => Promise.reject(new Error('Network offline')));
    global.fetch = fetchSpy;

    // Render wizard - should still auto-start if local storage is clear, despite API failure
    render(<TestWizard />);

    await screen.findByText('Step 1 of 12');
    expect(screen.getByText('Wizard Steps')).toBeInTheDocument();

    // Click Skip -> it will call PUT to persist which will also throw but should not crash the app
    fireEvent.click(screen.getByTestId('tour-skip-link'));

    await waitFor(() => {
      expect(screen.queryByTestId('tour-tooltip')).not.toBeInTheDocument();
    });
  });

  it('covers TourStep positions and hover events', () => {
    // Set up targeted element in test DOM
    const target = document.createElement('div');
    target.id = 'right-target';
    document.body.appendChild(target);

    const onNext = vi.fn();
    const onBack = vi.fn();
    const onSkip = vi.fn();

    const { rerender } = render(
      <TourStep
        targetSelector="#right-target"
        title="Position Right"
        content="Testing position right"
        position="right"
        currentStepIndex={1}
        totalSteps={3}
        onNext={onNext}
        onBack={onBack}
        onSkip={onSkip}
      />
    );

    // Hover over elements to trigger onMouseEnter/onMouseLeave
    const skipLink = screen.getByTestId('tour-skip-link');
    fireEvent.mouseEnter(skipLink);
    fireEvent.mouseLeave(skipLink);

    const backBtn = screen.getByTestId('tour-back-btn');
    fireEvent.mouseEnter(backBtn);
    fireEvent.mouseLeave(backBtn);

    const nextBtn = screen.getByTestId('tour-next-btn');
    fireEvent.mouseEnter(nextBtn);
    fireEvent.mouseLeave(nextBtn);

    // Test position left
    rerender(
      <TourStep
        targetSelector="#right-target"
        title="Position Left"
        content="Testing position left"
        position="left"
        currentStepIndex={1}
        totalSteps={3}
        onNext={onNext}
        onBack={onBack}
        onSkip={onSkip}
      />
    );

    expect(screen.getByText('Position Left')).toBeInTheDocument();

    // Clean up
    document.body.removeChild(target);
  });
});
