// @vitest-environment happy-dom

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ComparisonPanel from '../ComparisonPanel';

// Tests for ComparisonPanel in risk-profile and diff-highlighting scenarios.

describe('ComparisonPanel — risk-profile rows', () => {
  it('renders risk advantage rows with positive variant and check icons', () => {
    render(
      <ComparisonPanel
        title="Risk Advantages"
        items={['Lower max-loss cap', 'Higher compliance floor', 'Stable volatility score']}
        variant="positive"
      />,
    );
    const icons = screen.getAllByText('✓');
    expect(icons).toHaveLength(3);
    expect(screen.getByText('Lower max-loss cap')).toBeInTheDocument();
    expect(screen.getByText('Higher compliance floor')).toBeInTheDocument();
    expect(screen.getByText('Stable volatility score')).toBeInTheDocument();
  });

  it('renders risk disadvantage rows with negative variant and cross icons', () => {
    render(
      <ComparisonPanel
        title="Risk Disadvantages"
        items={['High drawdown risk', 'Low liquidity score']}
        variant="negative"
      />,
    );
    const icons = screen.getAllByText('✕');
    expect(icons).toHaveLength(2);
    expect(screen.getByText('High drawdown risk')).toBeInTheDocument();
    expect(screen.getByText('Low liquidity score')).toBeInTheDocument();
  });

  it('renders risk result rows with result variant and arrow icons', () => {
    render(
      <ComparisonPanel
        title="Net Assessment"
        items={['Commitment A is preferred']}
        variant="result"
      />,
    );
    expect(screen.getAllByText('→')).toHaveLength(1);
    expect(screen.getByText('Net Assessment')).toBeInTheDocument();
  });

  it('renders rows in correct order (diff: first item is highest priority)', () => {
    render(
      <ComparisonPanel
        title="Diff"
        items={['Critical diff', 'Minor diff', 'Negligible diff']}
        variant="negative"
      />,
    );
    const list = screen.getByRole('list');
    const rows = within(list).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Critical diff');
    expect(rows[1]).toHaveTextContent('Minor diff');
    expect(rows[2]).toHaveTextContent('Negligible diff');
  });

  it('renders heading for each panel (aria landmark)', () => {
    render(
      <ComparisonPanel title="Portfolio Risk Profile" items={['Item A']} variant="positive" />,
    );
    expect(screen.getByRole('heading', { name: 'Portfolio Risk Profile' })).toBeInTheDocument();
  });

  it('renders an empty list without crashing when no items are provided', () => {
    render(<ComparisonPanel title="Empty Profile" items={[]} variant="negative" />);
    expect(screen.getByRole('list').children).toHaveLength(0);
    expect(screen.getByText('Empty Profile')).toBeInTheDocument();
  });

  it('each row contains exactly one icon and one text node', () => {
    render(
      <ComparisonPanel
        title="Row structure"
        items={['Risk item alpha', 'Risk item beta']}
        variant="positive"
      />,
    );
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    rows.forEach((row) => {
      const icon = row.querySelector('[class*="icon"]') ?? row.firstElementChild;
      const text = row.querySelector('[class*="text"]') ?? row.lastElementChild;
      expect(icon).toBeTruthy();
      expect(text).toBeTruthy();
      expect(icon).not.toBe(text);
    });
  });
});
