// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import DisputeStatusTracker, {
  type DisputeInfo,
  type DisputeStage,
  type DisputeResolution,
} from './DisputeStatusTracker';

const BASE_DISPUTE: DisputeInfo = {
  stage: 'filed',
  filedAt: '2026-01-10T12:00:00.000Z',
  reasonCategory: 'Compliance issue',
};

function renderTracker(dispute: DisputeInfo | null) {
  return render(<DisputeStatusTracker dispute={dispute} />);
}

describe('DisputeStatusTracker', () => {
  describe('hidden when no dispute', () => {
    it('renders nothing when dispute is null', () => {
      const { container } = renderTracker(null);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('section and heading', () => {
    it('renders the "Dispute Status" heading', () => {
      renderTracker(BASE_DISPUTE);
      expect(screen.getByRole('heading', { name: /dispute status/i })).toBeInTheDocument();
    });

    it('renders as a section with an accessible label', () => {
      renderTracker(BASE_DISPUTE);
      expect(
        screen.getByRole('region', { name: /dispute status/i }),
      ).toBeInTheDocument();
    });
  });

  describe('stepper step labels', () => {
    it('renders all three step labels', () => {
      renderTracker(BASE_DISPUTE);
      const list = screen.getByRole('list', { name: /dispute lifecycle steps/i });
      expect(within(list).getByText('Filed')).toBeInTheDocument();
      expect(within(list).getByText('Under Review')).toBeInTheDocument();
      expect(within(list).getByText('Resolved')).toBeInTheDocument();
    });
  });

  describe('aria-current reflects the active step', () => {
    const cases: Array<{ stage: DisputeStage; currentLabel: string; pendingLabels: string[] }> = [
      {
        stage: 'filed',
        currentLabel: 'Filed',
        pendingLabels: ['Under Review', 'Resolved'],
      },
      {
        stage: 'under_review',
        currentLabel: 'Under Review',
        pendingLabels: ['Resolved'],
      },
      {
        stage: 'resolved',
        currentLabel: 'Resolved',
        pendingLabels: [],
      },
    ];

    cases.forEach(({ stage, currentLabel, pendingLabels }) => {
      it(`marks "${currentLabel}" as aria-current="step" when stage is "${stage}"`, () => {
        renderTracker({ ...BASE_DISPUTE, stage });
        const list = screen.getByRole('list', { name: /dispute lifecycle steps/i });
        const items = within(list).getAllByRole('listitem');

        const currentItem = items.find((li) =>
          li.textContent?.includes(currentLabel),
        );
        expect(currentItem).toHaveAttribute('aria-current', 'step');
      });

      it(`only one listitem has aria-current="step" when stage is "${stage}"`, () => {
        renderTracker({ ...BASE_DISPUTE, stage });
        const list = screen.getByRole('list', { name: /dispute lifecycle steps/i });
        const items = within(list).getAllByRole('listitem');
        const currentItems = items.filter(
          (li) => li.getAttribute('aria-current') === 'step',
        );
        expect(currentItems).toHaveLength(1);
      });

      if (pendingLabels.length > 0) {
        it(`pending steps after "${currentLabel}" have no aria-current when stage is "${stage}"`, () => {
          renderTracker({ ...BASE_DISPUTE, stage });
          const list = screen.getByRole('list', { name: /dispute lifecycle steps/i });
          const items = within(list).getAllByRole('listitem');
          pendingLabels.forEach((label) => {
            const item = items.find((li) => li.textContent?.includes(label));
            expect(item).not.toHaveAttribute('aria-current');
          });
        });
      }
    });

    it('completed steps (before current) have no aria-current', () => {
      renderTracker({ ...BASE_DISPUTE, stage: 'resolved' });
      const list = screen.getByRole('list', { name: /dispute lifecycle steps/i });
      const items = within(list).getAllByRole('listitem');

      const filedItem = items.find((li) => li.textContent?.includes('Filed'));
      const reviewItem = items.find((li) => li.textContent?.includes('Under Review'));
      expect(filedItem).not.toHaveAttribute('aria-current');
      expect(reviewItem).not.toHaveAttribute('aria-current');
    });
  });

  describe('timestamps displayed per step', () => {
    it('shows filedAt timestamp on the Filed step', () => {
      renderTracker(BASE_DISPUTE);
      // Jan 10, 2026 formatted
      expect(screen.getByText(/jan 10, 2026/i)).toBeInTheDocument();
    });

    it('shows reviewStartedAt on the Under Review step', () => {
      renderTracker({
        ...BASE_DISPUTE,
        stage: 'under_review',
        reviewStartedAt: '2026-01-11T08:00:00.000Z',
      });
      expect(screen.getByText(/jan 11, 2026/i)).toBeInTheDocument();
    });

    it('shows resolvedAt on the Resolved step', () => {
      renderTracker({
        ...BASE_DISPUTE,
        stage: 'resolved',
        reviewStartedAt: '2026-01-11T08:00:00.000Z',
        resolvedAt: '2026-01-13T15:00:00.000Z',
        resolution: 'dismissed',
      });
      expect(screen.getByText(/jan 13, 2026/i)).toBeInTheDocument();
    });

    it('omits timestamp elements when dates are absent', () => {
      renderTracker({ stage: 'filed' });
      // No ISO dates provided, so no formatted dates should appear
      expect(screen.queryByText(/jan/i)).toBeNull();
    });
  });

  describe('reasonCategory shown on Filed step', () => {
    it('renders the reasonCategory text when provided', () => {
      renderTracker({ ...BASE_DISPUTE, reasonCategory: 'Protocol violation' });
      expect(screen.getByText('Protocol violation')).toBeInTheDocument();
    });

    it('does not render a reason element when reasonCategory is absent', () => {
      renderTracker({ stage: 'filed', filedAt: '2026-01-10T12:00:00.000Z' });
      expect(screen.queryByText(/violation/i)).toBeNull();
    });
  });

  describe('resolution outcome on Resolved step', () => {
    const resolutionCases: Array<{ resolution: DisputeResolution; expectedText: string }> = [
      {
        resolution: 'resolved_in_favor_of_owner',
        expectedText: 'Resolved in your favor',
      },
      {
        resolution: 'resolved_in_favor_of_counterparty',
        expectedText: 'Resolved against you',
      },
      {
        resolution: 'dismissed',
        expectedText: 'Dismissed',
      },
    ];

    resolutionCases.forEach(({ resolution, expectedText }) => {
      it(`shows "${expectedText}" for resolution "${resolution}"`, () => {
        renderTracker({
          stage: 'resolved',
          filedAt: '2026-01-10T12:00:00.000Z',
          reviewStartedAt: '2026-01-11T08:00:00.000Z',
          resolvedAt: '2026-01-13T15:00:00.000Z',
          resolution,
        });
        expect(screen.getByText(expectedText)).toBeInTheDocument();
      });
    });

    it('shows no resolution detail when stage is "filed"', () => {
      renderTracker(BASE_DISPUTE);
      expect(screen.queryByText(/resolved in your favor/i)).toBeNull();
      expect(screen.queryByText(/resolved against you/i)).toBeNull();
      expect(screen.queryByText(/dismissed/i)).toBeNull();
    });

    it('shows no resolution detail when stage is "under_review"', () => {
      renderTracker({
        ...BASE_DISPUTE,
        stage: 'under_review',
        reviewStartedAt: '2026-01-11T08:00:00.000Z',
      });
      expect(screen.queryByText(/resolved in your favor/i)).toBeNull();
    });

    it('shows no resolution outcome when resolution is undefined on resolved step', () => {
      renderTracker({
        stage: 'resolved',
        filedAt: '2026-01-10T12:00:00.000Z',
        resolvedAt: '2026-01-13T15:00:00.000Z',
      });
      expect(screen.queryByText(/resolved in your favor/i)).toBeNull();
      expect(screen.queryByText(/resolved against you/i)).toBeNull();
      expect(screen.queryByText(/dismissed/i)).toBeNull();
    });
  });

  describe('step counts', () => {
    it('renders exactly 3 list items', () => {
      renderTracker(BASE_DISPUTE);
      const list = screen.getByRole('list', { name: /dispute lifecycle steps/i });
      expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    });
  });
});
