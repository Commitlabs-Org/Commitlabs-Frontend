/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import MyCommitmentCard from '@/components/MyCommitmentCard';
import type { Commitment, CommitmentType } from '@/types/commitment';

vi.mock('next/link', () => ({
  default: ({
        href,
        children,
        className,
        ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
        React.createElement('a', { href, className, ...rest }, children),
}));

const BASE_COMMITMENT: Commitment = {
    id: 'commitment-123',
    type: 'Safe',
    status: 'Active',
    asset: 'XLM',
    amount: '1,000',
    currentValue: '1,052',
    changePercent: 5.25,
    durationProgress: 42,
    daysRemaining: 18,
    complianceScore: 91,
    maxLoss: '5%',
    currentDrawdown: '1.2%',
    createdDate: '2026-06-01',
    expiryDate: '2026-07-01',
};

function commitment(overrides: Partial<Commitment> = {}): Commitment {
    return {
          ...BASE_COMMITMENT,
          ...overrides,
    };
}

function renderCard(
    overrides: Partial<Commitment> = {},
    callbacks: Partial<{
          onDetails: (id: string) => void;
          onAttestations: (id: string) => void;
          onEarlyExit: (id: string) => void;
    }> = {},
  ) {
    return render(
          <MyCommitmentCard commitment={commitment(overrides)} {...callbacks} />,
        );
}

describe('MyCommitmentCard', () => {
    afterEach(() => {
          cleanup();
          vi.clearAllMocks();
    });

           it.each<{
                 type: CommitmentType;
                 expectedClass: string;
           }>([
             {
                     type: 'Safe',
                     expectedClass: 'text-[#05DF72]',
             },
             {
                     type: 'Balanced',
                     expectedClass: 'text-[#51a2ff]',
             },
             {
                     type: 'Aggressive',
                     expectedClass: 'text-[#ff8904]',
             },
               ])('renders the $type type branch with its badge styling', ({ type, expectedClass }) => {
                 renderCard({ type });

                      const typeBadge = screen.getByText(type).closest('div');
                 expect(typeBadge).toBeInTheDocument();
                 expect(typeBadge?.className).toContain(expectedClass);
                 expect(typeBadge?.querySelector('svg')).toBeInTheDocument();
           });

           it('renders positive changePercent with increase styling and a plus sign', () => {
                 renderCard({ changePercent: 7.5 });

                  const change = screen.getByText('+7.50%');
                 expect(change).toBeInTheDocument();
                 expect(change.className).toContain('text-[#05DF72]');
                 expect(change.querySelector('svg')).toBeInTheDocument();
           });

           it('renders zero changePercent as non-negative with increase styling', () => {
                 renderCard({ changePercent: 0 });

                  const change = screen.getByText('+0.00%');
                 expect(change).toBeInTheDocument();
                 expect(change.className).toContain('text-[#05DF72]');
           });

           it('renders negative changePercent with decrease styling and no plus sign', () => {
                 renderCard({ changePercent: -3.42 });

                  const change = screen.getByText('-3.42%');
                 expect(change).toBeInTheDocument();
                 expect(change.className).toContain('text-[#EF4444]');
                 expect(change.querySelector('svg')).toBeInTheDocument();
           });

           it('calls action handlers with the commitment id', () => {
                 const onDetails = vi.fn();
                 const onAttestations = vi.fn();
                 const onEarlyExit = vi.fn();

                  renderCard(
                    {},
                    {
                              onDetails,
                              onAttestations,
                              onEarlyExit,
                    },
                        );

                  fireEvent.click(screen.getByRole('button', { name: /Details/i }));
                 fireEvent.click(screen.getByRole('button', { name: /Attestations/i }));
                 fireEvent.click(
                         screen.getByRole('button', { name: /Early Exit \(Penalty Applies\)/i }),
                       );

                  expect(onDetails).toHaveBeenCalledWith(BASE_COMMITMENT.id);
                 expect(onAttestations).toHaveBeenCalledWith(BASE_COMMITMENT.id);
                 expect(onEarlyExit).toHaveBeenCalledWith(BASE_COMMITMENT.id);
           });

           it('does not render Early Exit action for non-active commitments', () => {
                 renderCard({ status: 'Settled' });

                  expect(
                          screen.queryByRole('button', { name: /Early Exit \(Penalty Applies\)/i }),
                        ).not.toBeInTheDocument();
           });

           it('does not throw when optional action handlers are omitted', () => {
                 renderCard();

                  expect(() => {
                          fireEvent.click(screen.getByRole('button', { name: /Details/i }));
                          fireEvent.click(screen.getByRole('button', { name: /Attestations/i }));
                          fireEvent.click(
                                    screen.getByRole('button', { name: /Early Exit \(Penalty Applies\)/i }),
                                  );
                  }).not.toThrow();
           });
});
