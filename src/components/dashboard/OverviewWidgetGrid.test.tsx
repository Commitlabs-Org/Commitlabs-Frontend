/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { OverviewWidgetGrid, type WidgetConfig } from './OverviewWidgetGrid';

const WIDGETS: WidgetConfig[] = [
  { id: 'a', label: 'Alpha', visible: true, order: 1 },
  { id: 'b', label: 'Bravo', visible: true, order: 2 },
  { id: 'c', label: 'Charlie', visible: false, order: 3 },
];

function renderGrid(overrides: Partial<Record<string, unknown>> = {}) {
  const onReorder = vi.fn();
  const onToggleVisibility = vi.fn();
  const onReset = vi.fn();

  const result = render(
    <OverviewWidgetGrid
      widgets={WIDGETS}
      onReorder={onReorder}
      onToggleVisibility={onToggleVisibility}
      onReset={onReset}
      {...overrides}
    >
      {(id) => <div data-testid={`content-${id}`}>Content for {id}</div>}
    </OverviewWidgetGrid>,
  );

  return { ...result, onReorder, onToggleVisibility, onReset };
}

function getGrabHandles(): HTMLElement[] {
  return screen.getAllByRole('button', { name: /Reorder .+ widget/ });
}

describe('OverviewWidgetGrid', () => {
  describe('keyboard reorder – top boundary', () => {
    it('does not call onReorder when ArrowUp is pressed on the first item', async () => {
      const user = userEvent.setup();
      const { onReorder } = renderGrid();

      const firstHandle = getGrabHandles()[0];
      firstHandle.focus();
      await user.keyboard('{ArrowUp}');

      expect(onReorder).not.toHaveBeenCalled();
    });

    it('calls onReorder when ArrowDown is pressed on the first item', async () => {
      const user = userEvent.setup();
      const { onReorder } = renderGrid();

      const firstHandle = getGrabHandles()[0];
      firstHandle.focus();
      await user.keyboard('{ArrowDown}');

      expect(onReorder).toHaveBeenCalledTimes(1);
      expect(onReorder).toHaveBeenCalledWith(0, 1);
    });
  });

  describe('keyboard reorder – bottom boundary', () => {
    it('does not call onReorder when ArrowDown is pressed on the last item', async () => {
      const user = userEvent.setup();
      const { onReorder } = renderGrid();

      const handles = getGrabHandles();
      const lastHandle = handles[handles.length - 1];
      lastHandle.focus();
      await user.keyboard('{ArrowDown}');

      expect(onReorder).not.toHaveBeenCalled();
    });

    it('calls onReorder when ArrowUp is pressed on the last item', async () => {
      const user = userEvent.setup();
      const { onReorder } = renderGrid();

      const handles = getGrabHandles();
      const lastHandle = handles[handles.length - 1];
      lastHandle.focus();
      await user.keyboard('{ArrowUp}');

      expect(onReorder).toHaveBeenCalledTimes(1);
      expect(onReorder).toHaveBeenCalledWith(2, 1);
    });
  });

  describe('keyboard reorder – middle item', () => {
    it('calls onReorder with correct indices for ArrowUp and ArrowDown', async () => {
      const user = userEvent.setup();
      const { onReorder } = renderGrid();

      const middleHandle = getGrabHandles()[1];
      middleHandle.focus();
      await user.keyboard('{ArrowUp}');

      expect(onReorder).toHaveBeenCalledTimes(1);
      expect(onReorder).toHaveBeenCalledWith(1, 0);

      onReorder.mockClear();
      await user.keyboard('{ArrowDown}');

      expect(onReorder).toHaveBeenCalledTimes(1);
      expect(onReorder).toHaveBeenCalledWith(1, 2);
    });
  });

  describe('visibility toggle', () => {
    it('calls onToggleVisibility with the correct widget id', async () => {
      const user = userEvent.setup();
      const { onToggleVisibility } = renderGrid();

      const alphaToggle = screen.getByRole('button', {
        name: /Hide Alpha widget/,
      });
      await user.click(alphaToggle);

      expect(onToggleVisibility).toHaveBeenCalledTimes(1);
      expect(onToggleVisibility).toHaveBeenCalledWith('a');
    });

    it('calls onToggleVisibility with the id of a hidden widget', async () => {
      const user = userEvent.setup();
      const { onToggleVisibility } = renderGrid();

      const charlieToggle = screen.getByRole('button', {
        name: /Show Charlie widget/,
      });
      await user.click(charlieToggle);

      expect(onToggleVisibility).toHaveBeenCalledTimes(1);
      expect(onToggleVisibility).toHaveBeenCalledWith('c');
    });
  });

  describe('reset button', () => {
    it('calls onReset when the reset button is clicked', async () => {
      const user = userEvent.setup();
      const { onReset } = renderGrid();

      const resetButton = screen.getByRole('button', {
        name: /Reset widget layout to default/,
      });
      await user.click(resetButton);

      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('rendering', () => {
    it('renders widgets sorted by order', () => {
      renderGrid();

      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(3);

      const labels = items.map((item) => item.textContent);
      expect(labels[0]).toContain('Alpha');
      expect(labels[1]).toContain('Bravo');
      expect(labels[2]).toContain('Charlie');
    });

    it('renders child content for visible widgets only', () => {
      renderGrid();

      expect(screen.getByTestId('content-a')).toBeInTheDocument();
      expect(screen.getByTestId('content-b')).toBeInTheDocument();
      expect(screen.queryByTestId('content-c')).not.toBeInTheDocument();
    });
  });
});
