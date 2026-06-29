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
