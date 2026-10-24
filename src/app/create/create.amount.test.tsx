import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCommitments, resetCommitments } from '@/lib/commitments';
import CreatePage from './page';

vi.mock('@/components/WalletProvider', () => ({
  useWallet: () => ({ address: null }),
}));

vi.mock('@/lib/protocol', () => {
  const params = {
    penalties: { safe: 200, balanced: 500, aggressive: 1000 },
    gracePeriodSeconds: 0,
    isFallback: true,
  };
  return {
    FALLBACK_PROTOCOL_PARAMS: params,
    useProtocolParams: () => ({ params, loading: false, isFallback: true, refresh: () => {} }),
  };
});

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

function openConfigure() {
  render(<CreatePage />);
  click('Continue');
  return {
    amount: screen.getByLabelText('Amount') as HTMLInputElement,
    days: screen.getByLabelText('Lock duration (days)') as HTMLInputElement,
  };
}

beforeEach(() => {
  resetCommitments();
  window.localStorage.clear();
});
afterEach(cleanup);

describe('create wizard amount input', () => {
  it('constrains the inputs with a pattern and keyboard hint', () => {
    const { amount, days } = openConfigure();
    expect(amount.getAttribute('inputmode')).toBe('decimal');
    expect(amount.getAttribute('pattern')).toBe('\\d+(\\.\\d+)?');
    expect(days.getAttribute('inputmode')).toBe('numeric');
    expect(days.getAttribute('pattern')).toBe('\\d+');
  });

  it.each([
    ['1e3', /digits and one decimal point/i],
    ['0x10', /digits and one decimal point/i],
    ['.5.', /digits and one decimal point/i],
    ['-1', /digits and one decimal point/i],
    ['1,000', /digits and one decimal point/i],
    ['', /enter an amount\./i],
    ['   ', /enter an amount\./i],
    ['0', /greater than zero/i],
    ['0.00000001', /too many decimal places/i],
    ['100000.0000001', /above the maximum/i],
    ['1000000000000000000000', /above the maximum/i],
  ])('shows the inline reason for %j and blocks Review', (value, message) => {
    const { amount } = openConfigure();
    fireEvent.change(amount, { target: { value } });
    fireEvent.blur(amount);

    const err = document.getElementById('amount-err');
    expect(err?.textContent).toMatch(message);
    expect(amount.getAttribute('aria-invalid')).toBe('true');

    click('Review');
    expect(screen.getByRole('heading', { name: 'Configure' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Review' })).toBeNull();
    expect(document.activeElement).toBe(amount);
  });

  it('shows the reason on a Review attempt even without blur', () => {
    const { amount } = openConfigure();
    fireEvent.change(amount, { target: { value: '1e3' } });
    expect(document.getElementById('amount-err')).toBeNull();
    click('Review');
    expect(document.getElementById('amount-err')?.textContent).toMatch(/digits and one decimal point/i);
  });

  it.each([
    ['1e1', /whole days only/i],
    ['14.0', /whole days only/i],
    ['-3', /whole days only/i],
    ['', /enter the lock duration/i],
    ['0', /minimum lock is 1 day/i],
    ['366', /maximum lock is 365 days/i],
  ])('rejects duration %j with a specific reason', (value, message) => {
    const { days } = openConfigure();
    fireEvent.change(days, { target: { value } });
    fireEvent.blur(days);
    expect(document.getElementById('days-err')?.textContent).toMatch(message);
    click('Review');
    expect(screen.getByRole('heading', { name: 'Configure' })).toBeTruthy();
  });

  it('trims whitespace around a valid amount and reviews it with exact BigInt math', () => {
    const { amount, days } = openConfigure();
    fireEvent.change(amount, { target: { value: ' 1000 ' } });
    fireEvent.change(days, { target: { value: ' 14 ' } });
    expect(document.getElementById('amount-err')).toBeNull();
    click('Review');

    expect(screen.getByRole('heading', { name: 'Review' })).toBeTruthy();
    expect(screen.getByText('1,000 USDC')).toBeTruthy();
    // 1,000 balanced (700 bps) for 14 days = 2.6849315 (floored), penalty 5% = 50
    expect(screen.getByText('2.6849315 USDC')).toBeTruthy();
    expect(screen.getByText('5% (50 USDC)')).toBeTruthy();
  });

  it('accepts 1 stroop, shows it at full precision and stores base units as a string', () => {
    const { amount } = openConfigure();
    fireEvent.change(amount, { target: { value: '0.0000001' } });
    click('Review');
    expect(screen.getByText('0.0000001 USDC')).toBeTruthy();

    fireEvent.click(screen.getByRole('checkbox'));
    click('Create commitment');
    const [saved] = loadCommitments().items;
    expect(saved.amount).toBe('1');
  });

  it('stores the exact contract maximum', () => {
    const { amount } = openConfigure();
    fireEvent.change(amount, { target: { value: '100000' } });
    click('Review');
    fireEvent.click(screen.getByRole('checkbox'));
    click('Create commitment');
    expect(loadCommitments().items[0].amount).toBe('1000000000000');
  });
});
