import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPage from '@/app/settings/page';
import '@testing-library/jest-dom';

// Mock the useUnsavedChangesGuard hook to control isDirty state.
jest.mock('@/hooks/useUnsavedChangesGuard', () => ({
  useUnsavedChangesGuard: jest.fn(() => ({ isDirty: false, resetBaseline: jest.fn() })),
}));

describe('SettingsPage unsaved changes UI', () => {
  test('shows unsaved changes badge when dirty', async () => {
    // Re-mock to return dirty after toggling.
    const mockReset = jest.fn();
    const useUnsavedChangesGuard = require('@/hooks/useUnsavedChangesGuard').useUnsavedChangesGuard;
    useUnsavedChangesGuard.mockImplementation(() => ({ isDirty: true, resetBaseline: mockReset }));

    render(<SettingsPage />);
    // The badge should be visible.
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    // Save button should be enabled.
    const saveBtn = screen.getByRole('button', { name: /Save Preferences/i });
    expect(saveBtn).toBeEnabled();
  });

  test('disables Save button when no changes', () => {
    const useUnsavedChangesGuard = require('@/hooks/useUnsavedChangesGuard').useUnsavedChangesGuard;
    useUnsavedChangesGuard.mockImplementation(() => ({ isDirty: false, resetBaseline: jest.fn() }));
    render(<SettingsPage />);
    const saveBtn = screen.getByRole('button', { name: /Save Preferences/i });
    expect(saveBtn).toBeDisabled();
  });
});

describe('SettingsPage – Data & Privacy section', () => {
  test('renders the Data & Privacy section without console errors', () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    try {
      render(<SettingsPage />);

      // Section heading rendered by NotificationSection(title="Data & Privacy")
      // via the DataPrivacySection component. If <DataPrivacySection /> were
      // silently removed or its import were dropped, page.tsx's render call
      // would throw a ReferenceError and the test would fail via the throw.
      expect(
        screen.getByRole('heading', { name: /Data.*Privacy/i }),
      ).toBeInTheDocument();

      // These <h3> subheadings are uniquely rendered by DataPrivacySection's
      // own JSX (no aria-label override, plain text) and therefore prove the
      // component mounted and produced its expected structure.
      expect(
        screen.getByRole('heading', { name: /Export Account Data/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: /Clear Local Data/i }),
      ).toBeInTheDocument();

      // Acceptance criterion #2: explicit guard against the original bug mode
      // (React logging a "ReferenceError: … is not defined" to console.error
      // when a referenced component is undefined). We filter on the specific
      // signal so legitimate test noise — React 18 act() warnings, post-unmount
      // state-update warnings, framer-motion layout warnings under jsdom —
      // does NOT produce false negatives.
      const offending = consoleErrorSpy.mock.calls.filter((args) =>
        args.some((arg) => {
          if (typeof arg === 'string') {
            return /is not defined|ReferenceError/.test(arg);
          }
          if (arg instanceof Error) {
            return /is not defined|ReferenceError/(`${arg.name} ${arg.message}`);
          }
          return false;
        }),
      );
      expect(offending).toEqual([]);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
