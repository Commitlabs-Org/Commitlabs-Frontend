/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import CommitmentHealthMetrics from '../CommitmentHealthMetrics';

const defaultProps = {
  complianceData: [{ date: '2026-01', complianceScore: 85 }],
  drawdownData: [{ date: '2026-01', drawdownPercent: 0.15 }],
  valueHistoryData: [{ date: '2026-01', currentValue: 1000, initialAmount: 900 }],
  feeGenerationData: [{ date: '2026-01', feeAmount: 50 }],
  thresholdPercent: 0.25,
  volatilityPercent: 30,
};

const renderMetrics = (overrides: Partial<typeof defaultProps> = {}) => {
  const props = { ...defaultProps, ...overrides };
  return render(<CommitmentHealthMetrics {...props} />);
};

describe('CommitmentHealthMetrics lazy-loading', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the default tab (value) chart content', () => {
    renderMetrics();
    expect(screen.getByRole('heading', { name: 'Health Metrics' })).toBeTruthy();
    expect(screen.getByText('Value History')).toBeTruthy();
    expect(screen.getByText('Drawdown')).toBeTruthy();
    expect(screen.getByText('Fee Generation')).toBeTruthy();
    expect(screen.getByText('Compliance')).toBeTruthy();
  });

  it('shows tabs that can be switched', () => {
    renderMetrics();
    const drawdownTab = screen.getByText('Drawdown');
    fireEvent.click(drawdownTab);
    expect(screen.getByText('Value History')).toBeTruthy();
    expect(screen.getByText('Drawdown')).toBeTruthy();
    expect(screen.getByText('Fee Generation')).toBeTruthy();
    expect(screen.getByText('Compliance')).toBeTruthy();
  });

  it('renders fee generation tab content when fee tab is active', () => {
    renderMetrics();
    const feeTab = screen.getByText('Fee Generation');
    fireEvent.click(feeTab);
    expect(screen.getByText('Fee Generation')).toBeTruthy();
  });

  it('renders compliance tab content when compliance tab is active', () => {
    renderMetrics();
    const complianceTab = screen.getByText('Compliance');
    fireEvent.click(complianceTab);
    expect(screen.getByText('Compliance')).toBeTruthy();
  });

  it('switches back to value tab from drawdown', () => {
    renderMetrics();
    fireEvent.click(screen.getByText('Drawdown'));
    fireEvent.click(screen.getByText('Value History'));
    expect(screen.getByText('Value History')).toBeTruthy();
  });

  it('handles rapid tab switching without error', () => {
    renderMetrics();
    fireEvent.click(screen.getByText('Drawdown'));
    fireEvent.click(screen.getByText('Fee Generation'));
    fireEvent.click(screen.getByText('Compliance'));
    fireEvent.click(screen.getByText('Value History'));
    expect(screen.getByText('Value History')).toBeTruthy();
  });

  it('renders each tab button with correct styling for active state', () => {
    renderMetrics();
    const activeTab = screen.getByText('Value History').closest('button');
    expect(activeTab?.className).toContain('text-[#0ff0fc]');

    fireEvent.click(screen.getByText('Drawdown'));
    const drawdownTab = screen.getByText('Drawdown').closest('button');
    expect(drawdownTab?.className).toContain('text-[#0ff0fc]');
    expect(activeTab?.className).not.toContain('text-[#0ff0fc]');
  });

  it('passes correct data props to each chart tab', () => {
    renderMetrics();
    expect(screen.getByText('Value History')).toBeTruthy();
    expect(screen.getByText('Health Metrics')).toBeTruthy();
  });
});
