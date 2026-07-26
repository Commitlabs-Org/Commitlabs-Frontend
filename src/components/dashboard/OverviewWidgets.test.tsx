/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OverviewWidgetGrid, type WidgetConfig } from './OverviewWidgetGrid';

const defaultWidgets: WidgetConfig[] = [
  { id: 'at-risk', label: 'At-Risk Commitments', visible: true, order: 0 },
  { id: 'commitment-detail', label: 'Commitment Detail', visible: true, order: 1 },
];

const renderGrid = (overrides: {
  widgets?: WidgetConfig[];
  onReorder?: (from: number, to: number) => void;
  onToggleVisibility?: (id: string) => void;
  onReset?: () => void;
} = {}) => {
  const onReorder = overrides.onReorder ?? vi.fn();
  const onToggleVisibility = overrides.onToggleVisibility ?? vi.fn();
  const onReset = overrides.onReset ?? vi.fn();
  const widgets = overrides.widgets ?? defaultWidgets;

  const result = render(
    <OverviewWidgetGrid
      widgets={widgets}
      onReorder={onReorder}
      onToggleVisibility={onToggleVisibility}
      onReset={onReset}
    >
      {(id) => <div data-testid={`widget-${id}`}>{id} content</div>}
    </OverviewWidgetGrid>
  );

  return { ...result, onReorder, onToggleVisibility, onReset };
};

describe('OverviewWidgetGrid', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders all visible widgets', () => {
    renderGrid();
    expect(screen.getByTestId('widget-at-risk')).toBeTruthy();
    expect(screen.getByTestId('widget-commitment-detail')).toBeTruthy();
  });

  it('renders widget labels in the control bar', () => {
    renderGrid();
    expect(screen.getByText('At-Risk Commitments')).toBeTruthy();
    expect(screen.getByText('Commitment Detail')).toBeTruthy();
  });

  it('does not render hidden widget content', () => {
    const widgets: WidgetConfig[] = [
      { id: 'at-risk', label: 'At-Risk Commitments', visible: false, order: 0 },
      { id: 'commitment-detail', label: 'Commitment Detail', visible: true, order: 1 },
    ];
    renderGrid({ widgets });
    expect(screen.queryByTestId('widget-at-risk')).toBeNull();
    expect(screen.getByTestId('widget-commitment-detail')).toBeTruthy();
  });

  it('calls onToggleVisibility when eye button is clicked', () => {
    const onToggleVisibility = vi.fn();
    renderGrid({ onToggleVisibility });
    const hideButton = screen.getByLabelText('Hide At-Risk Commitments widget');
    fireEvent.click(hideButton);
    expect(onToggleVisibility).toHaveBeenCalledWith('at-risk');
  });

  it('calls onToggleVisibility to show a hidden widget', () => {
    const onToggleVisibility = vi.fn();
    const widgets: WidgetConfig[] = [
      { id: 'at-risk', label: 'At-Risk Commitments', visible: false, order: 0 },
      { id: 'commitment-detail', label: 'Commitment Detail', visible: true, order: 1 },
    ];
    renderGrid({ widgets, onToggleVisibility });
    const showButton = screen.getByLabelText('Show At-Risk Commitments widget');
    fireEvent.click(showButton);
    expect(onToggleVisibility).toHaveBeenCalledWith('at-risk');
  });

  it('calls onReset when reset button is clicked', () => {
    const onReset = vi.fn();
    renderGrid({ onReset });
    const resetButton = screen.getByRole('button', { name: /reset to default/i });
    fireEvent.click(resetButton);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('calls onReorder on ArrowUp key press', () => {
    const onReorder = vi.fn();
    renderGrid({ onReorder });
    const reorderButtons = screen.getAllByLabelText(/reorder/i);
    // Second widget (index 1), press ArrowUp
    fireEvent.keyDown(reorderButtons[1]!, { key: 'ArrowUp' });
    expect(onReorder).toHaveBeenCalledWith(1, 0);
  });

  it('calls onReorder on ArrowDown key press', () => {
    const onReorder = vi.fn();
    renderGrid({ onReorder });
    const reorderButtons = screen.getAllByLabelText(/reorder/i);
    // First widget (index 0), press ArrowDown
    fireEvent.keyDown(reorderButtons[0]!, { key: 'ArrowDown' });
    expect(onReorder).toHaveBeenCalledWith(0, 1);
  });

  it('does not call onReorder on ArrowUp at first position', () => {
    const onReorder = vi.fn();
    renderGrid({ onReorder });
    const reorderButtons = screen.getAllByLabelText(/reorder/i);
    fireEvent.keyDown(reorderButtons[0]!, { key: 'ArrowUp' });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('does not call onReorder on ArrowDown at last position', () => {
    const onReorder = vi.fn();
    renderGrid({ onReorder });
    const reorderButtons = screen.getAllByLabelText(/reorder/i);
    fireEvent.keyDown(reorderButtons[1]!, { key: 'ArrowDown' });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('has aria-live region for announcements', () => {
    renderGrid();
    const liveRegion = screen.getByRole('list', { name: /overview widgets/i });
    expect(liveRegion.getAttribute('aria-live')).toBe('polite');
  });

  it('renders widget list with accessible role', () => {
    renderGrid();
    expect(screen.getByRole('list', { name: /overview widgets/i })).toBeTruthy();
  });
});

describe('OverviewWidgetGrid — hide/show persistence edge cases', () => {
  afterEach(() => cleanup());

  it('shows EyeOff icon label for hidden widget', () => {
    const widgets: WidgetConfig[] = [
      { id: 'at-risk', label: 'At-Risk Commitments', visible: false, order: 0 },
    ];
    renderGrid({ widgets });
    expect(screen.getByLabelText('Show At-Risk Commitments widget')).toBeTruthy();
  });

  it('shows Eye icon label for visible widget', () => {
    renderGrid();
    expect(screen.getByLabelText('Hide At-Risk Commitments widget')).toBeTruthy();
  });

  it('renders widgets in order defined by order field', () => {
    const widgets: WidgetConfig[] = [
      { id: 'commitment-detail', label: 'Commitment Detail', visible: true, order: 0 },
      { id: 'at-risk', label: 'At-Risk Commitments', visible: true, order: 1 },
    ];
    renderGrid({ widgets });
    const labels = screen.getAllByText(/At-Risk Commitments|Commitment Detail/);
    expect(labels[0]?.textContent).toBe('Commitment Detail');
    expect(labels[1]?.textContent).toBe('At-Risk Commitments');
  });
});
