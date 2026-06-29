import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RiskProfileComparison from './RiskProfileComparison';

describe('RiskProfileComparison', () => {
  const mockConfig = {
    riskProfiles: [
      { id: 'conservative', name: 'Conservative', description: 'Low risk', maxLossBps: 1000 },
      { id: 'balanced', name: 'Balanced', description: 'Medium risk', maxLossBps: 5000 },
      { id: 'aggressive', name: 'Aggressive', description: 'High risk', maxLossBps: 10000 },
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
});
