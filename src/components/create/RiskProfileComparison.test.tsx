import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RiskProfileComparison from './RiskProfileComparison';

describe('RiskProfileComparison', () => {
  const mockConfig = {
    riskProfiles: [
      { id: 'conservative', name: 'Conservative', description: 'Low risk', maxLossBps: 1000, lockDurationDays: 30 },
      { id: 'balanced', name: 'Balanced', description: 'Medium risk', maxLossBps: 5000, lockDurationDays: 60 },
      { id: 'aggressive', name: 'Aggressive', description: 'High risk', maxLossBps: 10000, lockDurationDays: 90 },
    ],
  };

  beforeEach(() => {
    // @ts-ignore
    global.fetch = jest.fn().mockResolvedValue({ json: async () => mockConfig });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('renders columns based on fetched profiles', async () => {
    const onSelect = jest.fn();
    render(<RiskProfileComparison selectedType={null} onSelectType={onSelect} />);
    // Wait for fetch
    expect(await screen.findByText('Conservative')).toBeInTheDocument();
    expect(screen.getByText('Balanced')).toBeInTheDocument();
    expect(screen.getByText('Aggressive')).toBeInTheDocument();
  });

  test('clicking a column calls onSelectType with correct mapped type', async () => {
    const onSelect = jest.fn();
    render(<RiskProfileComparison selectedType={null} onSelectType={onSelect} />);
    const conservativeTitle = await screen.findByText('Conservative');
    fireEvent.click(conservativeTitle.closest('div')!);
    expect(onSelect).toHaveBeenCalledWith('safe');
  });

  test('keyboard navigation and selection', async () => {
    const onSelect = jest.fn();
    render(<RiskProfileComparison selectedType={null} onSelectType={onSelect} />);
    const firstColumn = await screen.findByText('Conservative');
    const firstDiv = firstColumn.closest('div')!;
    firstDiv.focus();
    fireEvent.keyDown(firstDiv, { key: 'ArrowRight' });
    // Move focus to next column
    const secondDiv = screen.getByText('Balanced').closest('div')!;
    expect(document.activeElement).toBe(secondDiv);
    fireEvent.keyDown(secondDiv, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('balanced');
  });

  test('renders the lock duration from the API response', async () => {
    render(<RiskProfileComparison selectedType={null} onSelectType={jest.fn()} />);

    expect(await screen.findByText('Conservative')).toBeInTheDocument();
    expect(await screen.findByText('Lock Duration: 30d')).toBeInTheDocument();
  });

  test('shows an error state when the config request fails', async () => {
    // @ts-ignore
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

    render(<RiskProfileComparison selectedType={null} onSelectType={jest.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load risk profiles');
  });
});
