import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MaturityCountdown } from '../MaturityCountdown';

describe('MaturityCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-29T00:00:00Z').getTime());
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders healthy status for > 7 days', () => {
    const tenDaysLater = new Date('2026-07-09T00:00:00Z').getTime();
    render(<MaturityCountdown maturityTimestamp={tenDaysLater} />);
    
    const badge = screen.getByText('10d 0h 0m');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('badge-healthy');
  });

  it('renders warning status for <= 7 days', () => {
    const fiveDaysLater = new Date('2026-07-04T00:00:00Z').getTime();
    render(<MaturityCountdown maturityTimestamp={fiveDaysLater} />);
    
    const badge = screen.getByText('5d 0h 0m');
    expect(badge).toHaveClass('badge-warning');
  });

  it('renders critical status for <= 24 hours', () => {
    const twelveHoursLater = new Date('2026-06-29T12:00:00Z').getTime();
    render(<MaturityCountdown maturityTimestamp={twelveHoursLater} />);
    
    const badge = screen.getByText('12h 0m');
    expect(badge).toHaveClass('badge-critical');
  });

  it('renders matured status and text when time has passed', () => {
    const pastTime = new Date('2026-06-28T00:00:00Z').getTime();
    render(<MaturityCountdown maturityTimestamp={pastTime} />);
    
    const badge = screen.getByText('Matured');
    expect(badge).toHaveClass('badge-matured');
  });

  it('updates text dynamically and clears interval on unmount', () => {
    const target = new Date('2026-06-29T00:02:00Z').getTime();
    const { unmount } = render(<MaturityCountdown maturityTimestamp={target} />);
    
    expect(screen.getByText('2m')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60000); // Advance 1 minute
    });
    
    expect(screen.getByText('1m')).toBeInTheDocument();

    // Verify interval cleanup
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});