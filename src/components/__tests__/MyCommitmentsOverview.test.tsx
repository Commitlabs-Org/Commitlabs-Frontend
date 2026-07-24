// @vitest-environment happy-dom

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MyCommitmentsOverview from '../MyCommitmentsOverview/MyCommitmentsOverview';

vi.mock('../MyCommitmentsStats/MyCommitmentsStats', () => ({
  default: ({ totalActive, totalCommittedValue, averageComplianceScore, totalFeesGenerated }: {
    totalActive: number;
    totalCommittedValue: string;
    averageComplianceScore: string;
    totalFeesGenerated: string;
  }) => (
    <div data-testid="stats">
      <span data-testid="stat-active">{totalActive}</span>
      <span data-testid="stat-value">{totalCommittedValue}</span>
      <span data-testid="stat-compliance">{averageComplianceScore}</span>
      <span data-testid="stat-fees">{totalFeesGenerated}</span>
    </div>
  ),
}));

vi.mock('../MyCommitmentsFilters/MyCommitmentsFilters', () => ({
  default: ({
    searchQuery,
    onSearchChange,
    status,
    type,
    onStatusChange,
    onTypeChange,
  }: {
    searchQuery: string;
    onSearchChange: (v: string) => void;
    status: string;
    type: string;
    onStatusChange: (v: string) => void;
    onTypeChange: (v: string) => void;
  }) => (
    <div data-testid="filters">
      <input
        data-testid="search-input"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label="Search commitments"
      />
      <select
        data-testid="status-filter"
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        aria-label="Status filter"
      >
        <option value="">All</option>
        <option value="active">Active</option>
      </select>
      <select
        data-testid="type-filter"
        value={type}
        onChange={(e) => onTypeChange(e.target.value)}
        aria-label="Type filter"
      >
        <option value="">All</option>
        <option value="Balanced">Balanced</option>
      </select>
    </div>
  ),
}));

const DEFAULT_PROPS = {
  stats: {
    totalActive: 7,
    totalCommittedValue: '$125,000',
    averageComplianceScore: '94.2%',
    totalFeesGenerated: '$1,280',
  },
  search: {
    searchQuery: '',
    onSearchChange: vi.fn(),
  },
  filters: {
    status: '',
    type: '',
    onStatusChange: vi.fn(),
    onTypeChange: vi.fn(),
  },
};

describe('MyCommitmentsOverview — aggregation', () => {
  it('passes totalActive to the stats component', () => {
    render(<MyCommitmentsOverview {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('stat-active')).toHaveTextContent('7');
  });

  it('passes totalCommittedValue to the stats component', () => {
    render(<MyCommitmentsOverview {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('stat-value')).toHaveTextContent('$125,000');
  });

  it('passes averageComplianceScore to the stats component', () => {
    render(<MyCommitmentsOverview {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('stat-compliance')).toHaveTextContent('94.2%');
  });

  it('passes totalFeesGenerated to the stats component', () => {
    render(<MyCommitmentsOverview {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('stat-fees')).toHaveTextContent('$1,280');
  });
});

describe('MyCommitmentsOverview — grid wiring', () => {
  it('renders the filters component', () => {
    render(<MyCommitmentsOverview {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('filters')).toBeInTheDocument();
  });

  it('wires searchQuery into filters', () => {
    render(
      <MyCommitmentsOverview
        {...DEFAULT_PROPS}
        search={{ ...DEFAULT_PROPS.search, searchQuery: 'defi' }}
      />,
    );
    expect(screen.getByTestId('search-input')).toHaveValue('defi');
  });

  it('calls onSearchChange when the search input changes', () => {
    const onSearchChange = vi.fn();
    render(
      <MyCommitmentsOverview
        {...DEFAULT_PROPS}
        search={{ searchQuery: '', onSearchChange }}
      />,
    );
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'yield' } });
    expect(onSearchChange).toHaveBeenCalledWith('yield');
  });

  it('calls onStatusChange when status filter changes', () => {
    const onStatusChange = vi.fn();
    render(
      <MyCommitmentsOverview
        {...DEFAULT_PROPS}
        filters={{ ...DEFAULT_PROPS.filters, onStatusChange }}
      />,
    );
    fireEvent.change(screen.getByTestId('status-filter'), { target: { value: 'active' } });
    expect(onStatusChange).toHaveBeenCalledWith('active');
  });

  it('calls onTypeChange when type filter changes', () => {
    const onTypeChange = vi.fn();
    render(
      <MyCommitmentsOverview
        {...DEFAULT_PROPS}
        filters={{ ...DEFAULT_PROPS.filters, onTypeChange }}
      />,
    );
    fireEvent.change(screen.getByTestId('type-filter'), { target: { value: 'Balanced' } });
    expect(onTypeChange).toHaveBeenCalledWith('Balanced');
  });
});
