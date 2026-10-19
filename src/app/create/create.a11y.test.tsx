import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CreatePage from './page';

vi.mock('@/components/WalletProvider', () => ({
  useWallet: () => ({ address: null }),
}));

async function expectNoSeriousViolations(container: HTMLElement) {
  const results = await axe(container);
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe('create wizard accessibility', () => {
  it('step 1 (type) has no serious axe violations and exposes a radiogroup', async () => {
    const { container } = render(<CreatePage />);
    await expectNoSeriousViolations(container);
    expect(screen.getByRole('radiogroup')).toBeTruthy();
    // aria-current is set on the active step only
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain('Type');
  });

  it('arrow keys move selection and focus within the radiogroup', () => {
    render(<CreatePage />);
    const radios = screen.getAllByRole('radio');
    const checked = () => radios.findIndex((r) => r.getAttribute('aria-checked') === 'true');
    const start = checked();
    radios[start].focus();
    fireEvent.keyDown(radios[start], { key: 'ArrowRight' });
    const next = (start + 1) % radios.length;
    expect(checked()).toBe(next);
    expect(document.activeElement).toBe(radios[next]);
    fireEvent.keyDown(radios[next], { key: 'ArrowLeft' });
    expect(checked()).toBe(start);
    expect(radios[start].getAttribute('tabindex')).toBe('0');
  });

  it('moves focus to the heading and announces each step', async () => {
    const { container } = render(<CreatePage />);
    click('Continue');
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Configure' }));
    expect(screen.getByRole('status').textContent).toBe('Step 2 of 4: Configure');
    await expectNoSeriousViolations(container);

    click('Review');
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Review' }));
    expect(screen.getByRole('status').textContent).toBe('Step 3 of 4: Review');
    expect(screen.getAllByText('(completed)', { exact: false })).toHaveLength(2);
    await expectNoSeriousViolations(container);

    click('Back');
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Configure' }));

    click('Review');
    fireEvent.click(screen.getByRole('checkbox'));
    click('Create commitment');
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Commitment created' }));
    expect(screen.getByRole('status').textContent).toBe('Step 4 of 4: Done');
    await expectNoSeriousViolations(container);
  });

  it('links errors to inputs via aria-describedby, only after blur or submit attempt', () => {
    render(<CreatePage />);
    click('Continue');
    const amount = screen.getByLabelText('Amount');
    expect(amount.getAttribute('aria-invalid')).toBe('false');
    fireEvent.change(amount, { target: { value: '0' } });
    expect(document.getElementById('amount-err')).toBeNull();

    fireEvent.blur(amount);
    const err = document.getElementById('amount-err');
    expect(err?.textContent).toMatch(/greater than zero/);
    expect(amount.getAttribute('aria-invalid')).toBe('true');
    expect(amount.getAttribute('aria-describedby')).toContain('amount-err');
    expect(amount.getAttribute('aria-describedby')).toContain('amount');

    fireEvent.change(amount, { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Lock duration (days)'), { target: { value: '1' } });
    click('Review');
    const days = screen.getByLabelText('Lock duration (days)');
    expect(days.getAttribute('aria-describedby')).toContain('days-err');
    expect(document.activeElement).toBe(days);
    expect(screen.getByRole('heading', { name: 'Configure' })).toBeTruthy();
  });

  it('announces the step once in React strict mode', () => {
    render(
      <StrictMode>
        <CreatePage />
      </StrictMode>,
    );
    expect(screen.getByRole('status').textContent).toBe('');
    click('Continue');
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toBe('Step 2 of 4: Configure');
  });
});
