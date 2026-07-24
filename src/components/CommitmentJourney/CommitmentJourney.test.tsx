// @vitest-environment happy-dom

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CommitmentJourney from './CommitmentJourney';

describe('CommitmentJourney — milestone states', () => {
  it('renders the section heading', () => {
    render(<CommitmentJourney />);
    expect(screen.getByRole('heading', { level: 1, name: /Alice.*Commitment Journey/i })).toBeInTheDocument();
  });

  it('renders the USER JOURNEY badge', () => {
    render(<CommitmentJourney />);
    expect(screen.getByText('USER JOURNEY')).toBeInTheDocument();
  });

  it('renders all 4 step indicators (milestones)', () => {
    render(<CommitmentJourney />);
    const indicators = screen.getAllByText(/^[1-4]$/);
    expect(indicators.length).toBeGreaterThanOrEqual(4);
  });

  it('step 1 heading is "Choose Your Commitment Type"', () => {
    render(<CommitmentJourney />);
    expect(
      screen.getByRole('heading', { name: 'Choose Your Commitment Type' }),
    ).toBeInTheDocument();
  });

  it('step 2 heading is "Receive Commitment NFT"', () => {
    render(<CommitmentJourney />);
    expect(screen.getByRole('heading', { name: 'Receive Commitment NFT' })).toBeInTheDocument();
  });

  it('step 3 heading is "Reuse as Collateral"', () => {
    render(<CommitmentJourney />);
    expect(screen.getByRole('heading', { name: 'Reuse as Collateral' })).toBeInTheDocument();
  });

  it('renders three commitment type cards: Safe, Balanced, Aggressive', () => {
    render(<CommitmentJourney />);
    expect(screen.getByRole('heading', { name: 'Safe Commitment' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Balanced Commitment' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Aggressive Commitment' })).toBeInTheDocument();
  });

  it('Safe Commitment card shows 30-day duration and 2% max loss', () => {
    render(<CommitmentJourney />);
    const heading = screen.getByRole('heading', { name: 'Safe Commitment' });
    const card = heading.closest('div');
    expect(card).toBeTruthy();
    const cardEl = card as HTMLElement;
    expect(within(cardEl).getByText('30 days')).toBeInTheDocument();
    expect(within(cardEl).getByText('2%')).toBeInTheDocument();
  });

  it('Balanced Commitment card shows 60-day duration', () => {
    render(<CommitmentJourney />);
    const heading = screen.getByRole('heading', { name: 'Balanced Commitment' });
    const card = (heading.closest('div') as HTMLElement);
    expect(within(card).getByText('60 days')).toBeInTheDocument();
  });

  it('renders the subtitle describing Alice\'s deployment', () => {
    render(<CommitmentJourney />);
    expect(screen.getByText(/\$100,000/)).toBeInTheDocument();
  });

  it('wraps content in a section landmark', () => {
    render(<CommitmentJourney />);
    expect(screen.getByRole('region')).toBeInTheDocument();
  });
});
