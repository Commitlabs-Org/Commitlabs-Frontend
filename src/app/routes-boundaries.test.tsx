import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ActivityLoading from './activity/loading';
import ActivityError from './activity/error';
import CommitmentLoading from './commitments/[id]/loading';
import CommitmentDetailError from './commitments/[id]/error';

describe('Route loading skeletons and error boundaries', () => {
  it('loading skeleton has aria-busy for activity route', () => {
    const { container } = render(<ActivityLoading />);
    const section = container.querySelector('section[aria-busy="true"]');
    expect(section).toBeDefined();
    expect(section?.getAttribute('aria-label')).toBe('Loading activity feed');
  });

  it('loading skeleton has aria-busy for commitment detail route', () => {
    const { container } = render(<CommitmentLoading />);
    const section = container.querySelector('section[aria-busy="true"]');
    expect(section).toBeDefined();
    expect(section?.getAttribute('aria-label')).toBe('Loading commitment details');
  });

  it('activity error boundary shows retry and calls reset once', () => {
    const resetSpy = vi.fn();
    const error = new Error('RPC connection timed out');

    render(<ActivityError error={error} reset={resetSpy} />);

    expect(screen.getByText('Failed to load activity feed')).toBeDefined();
    expect(screen.getByText(/RPC connection timed out/)).toBeDefined();

    const retryBtn = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(retryBtn);

    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  it('detail error boundary links to /dashboard', () => {
    const resetSpy = vi.fn();
    const error = new Error('Commitment record corrupted');

    render(<CommitmentDetailError error={error} reset={resetSpy} />);

    expect(screen.getByText('Unable to load commitment')).toBeDefined();
    expect(screen.getByText(/Commitment record corrupted/)).toBeDefined();

    const dashboardLink = screen.getByRole('link', { name: /back to dashboard/i });
    expect(dashboardLink).toBeDefined();
    expect(dashboardLink.getAttribute('href')).toBe('/dashboard');

    const retryBtn = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(retryBtn);
    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  it('error text rendered as text not HTML', () => {
    const maliciousMsg = '<img src=x onerror=alert(1)>Malicious Payload';
    const error = new Error(maliciousMsg);

    const { container } = render(<ActivityError error={error} reset={() => {}} />);
    expect(screen.getByText(new RegExp(maliciousMsg))).toBeDefined();
    expect(container.querySelector('img')).toBeNull();

    const { container: detailContainer } = render(
      <CommitmentDetailError error={error} reset={() => {}} />
    );
    expect(screen.getByText(new RegExp(maliciousMsg))).toBeDefined();
    expect(detailContainer.querySelector('img')).toBeNull();
  });
});
