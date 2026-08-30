import { describe, it, expect } from 'vitest';
import { reduce, DraftState, DraftEvent } from '@/lib/draftRecovery';

const __initial: DraftState = { status: 'draft' };

function rduceState(state: DraftState | undefined, event: DraftEvent): DraftState {
  return reduce(state, event);
}

describe('commitment creation state machine', () => {
  it('starts in draft state', () => {
    expect(rduceState(undefined, { type: 'START' }).status).toBe('draft');
  });

  it('allows START from draft and sets data', () => {
    const s = rduceState({ status: 'draft' }, { type: 'START', step: 2, data: { amount: '100' } });
    expect(s.status).toBe('draft');
    expect(s.step).toBe(2);
    expect(s.data).toEqual({ amount: '100' });
  });

  it('ignores START while submitting', () => {
    const s: DraftState = { status: 'submitting', id: 'sub-1' };
    const next = rduceState(s, { type: 'START' });
    expect(next).toBe(s);
  });

  it('ignores START while confirmed', () => {
    const s: DraftState = { status: 'confirmed' };
    const next = rduceState(s, { type: 'START' });
    expect(next).toBe(s);
  });

  it('allows submit from draft and stores submission id', () => {
    const s = rduceState({ status: 'draft' }, { type: 'SUBMIT', id: 'sub-1' });
    expect(s.status).toBe('submitting');
    expect(s.id).toBe('sub-1');
  });

  it('ignores submit without a submission id', () => {
    const s = rduceState({ status: 'draft' }, { type: 'SUBMIT', id: '' });
    expect(s.status).toBe('draft');
  });

  it('ignores duplicate submit while already submitting', () => {
    const s: DraftState = { status: 'submitting', id: 'sub-1' };
    const next = rduceState(s, { type: 'SUBMIT', id: 'sub-2' });
    expect(next).toBe(s);
  });

  it('ignores submit from confirmed', () => {
    const s: DraftState = { status: 'confirmed' };
    const next = rduceState(s, { type: 'SUBMIT', id: 'sub-1' });
    expect(next).toBe(s);
  });

  it('transitions to confirmed on SUCCESS with matching id', () => {
    const s: DraftState = { status: 'submitting', id: 'sub-1' };
    const next = rduceState(s, { type: 'SUCCESS', id: 'sub-1' });
    expect(next.status).toBe('confirmed');
  });

  it('ignores SUCCESS with stale id', () => {
    const s: DraftState = { status: 'submitting', id: 'sub-1' };
    const next = rduceState(s, { type: 'SUCCESS', id: 'sub-2' });
    expect(next).toBe(s);
  });

  it('transitions to failed on FAILURE and clears submission id', () => {
    const s: DraftState = { status: 'submitting', id: 'sub-1' };
    const next = rduceState(s, { type: 'FAILURE', id: 'sub-1', error: 'rejected' });
    expect(next.status).toBe('failed');
    expect(next.id).toBe(null);
    expect(next.error).toBe('rejected');
  });

  it('ignores FAILURE with stale id', () => {
    const s: DraftState = { status: 'submitting', id: 'sub-1' };
    const next = rduceState(s, { type: 'FAILURE', id: 'sub-2', error: 'x' });
    expect(next).toBe(s);
  });

  it('allows cancel from draft, submitting, and failed', () => {
    for (const status of ['draft', 'submitting', 'failed'] as const) {
      const s: DraftState = { status, id: status === 'submitting' ? 'sub-1' : null };
      const next = rduceState(s, { type: 'CANCEL' });
      expect(next.status).toBe('cancelled');
    }
  });

  it('ignores cancel from confirmed', () => {
    const s: DraftState = { status: 'confirmed' };
    const next = rduceState(s, { type: 'CANCEL' });
    expect(next).toBe(s);
  });

  it('allows retry from failed and clears error', () => {
    const s: DraftState = { status: 'failed', error: 'error', id: null };
    const next = rduceState(s, { type: 'RETRY' });
    expect(next.status).toBe('draft');
    expect(next.error).toBe(null);
  });

  it('ignores retry from draft', () => {
    const s: DraftState = { status: 'draft' };
    const next = rduceState(s, { type: 'RETRY' });
    expect(next).toBe(s);
  });

  it('recovers persisted submitting state as failed', () => {
    const s: DraftState = { status: 'draft' };
    const from: DraftState = { status: 'submitting', id: 'sub-1', step: 2, data: { amount: '10' } };
    const next = rduceState(s, { type: 'RECOVER', from });
    expect(next.status).toBe('failed');
    expect(next.id).toBe(null);
    expect(next.error).toBe('recovered');
  });

  it('recovers persisted draft state as draft', () => {
    const s: DraftState = { status: 'draft' };
    const from: DraftState = { status: 'draft', step: 1, data: { amount: '10' } };
    const next = rduceState(s, { type: 'RECOVER', from });
    expect(next.status).toBe('draft');
    expect(next.step).toBe(1);
    expect(next.data).toEqual({ amount: '10' });
  });

  it('does not override an in-flight submission during RECOVER', () => {
    const s: DraftState = { status: 'submitting', id: 'sub-1' };
    const from: DraftState = { status: 'draft' };
    const next = rduceState(s, { type: 'RECOVER', from });
    expect(next).toBe(s);
  });

  it('does not overwrite confirmed state during RECOVER', () => {
    const s: DraftState = { status: 'confirmed' };
    const from: DraftState = { status: 'draft' };
    const next = rduceState(s, { type: 'RECOVER', from });
    expect(next).toBe(s);
  });

  it('resumes a draft into editing state', () => {
    const s: DraftState = { status: 'draft' };
    const next = rduceState(s, { type: 'RESUME', draftId: 'draft-1', step: 2, data: { amount: '5' } });
    expect(next.status).toBe('draft');
    expect(next.draftId).toBe('draft-1');
    expect(next.step).toBe(2);
    expect(next.data).toEqual({ amount: '5' });
  });

  it('allows editing from draft state', () => {
    const s: DraftState = { status: 'draft', step: 1, data: {} };
    const next = rduceState(s, { type: 'EDIT', step: 2, data: { amount: '10' } });
    expect(next.step).toBe(2);
    expect(next.data).toEqual({ amount: '10' });
  });

  it('allows editing from cancelled state', () => {
    const s: DraftState = { status: 'cancelled' };
    const next = rduceState(s, { type: 'EDIT', step: 1, data: {} });
    expect(next.status).toBe('draft');
  });

  it('ignores editing while submitting', () => {
    const s: DraftState = { status: 'submitting', id: 'sub-1' };
    const next = rduceState(s, { type: 'EDIT', step: 3 });
    expect(next).toBe(s);
  });
});