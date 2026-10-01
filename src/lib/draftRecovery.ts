// State machine for the commitment creation wizard and draft recovery.
// Invariants:
// - Only one active submission at a time: SUBMIT is ignored if already submitting.
// - SUCCESS/FAILURE events must match the current submission id, preventing stale responses.
// - CANCEL is allowed from draft, submitting, or failed, but never overrides a confirmed commitment.
// - RETRY is only allowed from failed and always clears the submission id.
// - RECOVER never overwrites an in-flight or confirmed state, and converts any persisted
//   "submitting" state to "failed" so the user must explicitly verify/retry instead of
//   silently repeating an on-chain action.

export interface DraftState {
  status: 'draft' | 'submitting' | 'confirmed' | 'failed' | 'cancelled';
  step?: number;
  data?: unknown;
  id?: string | null;
  error?: string | null;
  owner?: string | null;
  updatedAt?: number;
  draftId?: string | null;
}

export type DraftEvent =
  | { type: 'START'; draftId?: string; step?: number; data?: unknown }
  | { type: 'EDIT'; draftId?: string; step?: number; data?: unknown }
  | { type: 'SUBMIT'; id: string }
  | { type: 'SUCCESS'; id: string }
  | { type: 'FAILURE'; id: string; error?: string }
  | { type: 'CANCEL' }
  | { type: 'RETRY' }
  | { type: 'RECOVER'; from?: Partial<DraftState> }
  | { type: 'RESUME'; draftId: string; step: number; data: unknown };

export function reduce(state: DraftState | undefined, event: DraftEvent): DraftState {
  const s: DraftState = state ?? ({ status: 'draft' } as DraftState);
  const n = Date.now();
  const ok = (patch: Partial<DraftState>): DraftState => ({ ...s, ...patch, updatedAt: n });

  switch (event.type) {
    case 'START':
      if (s.status === 'submitting' || s.status === 'confirmed') return s;
      return ok({ status: 'draft', draftId: event.draftId ?? s.draftId, step: event.step, data: event.data, id: null, error: null });

    case 'EDIT':
      if (s.status !== 'draft' && s.status !== 'cancelled') return s;
      return ok({ status: 'draft', draftId: event.draftId ?? s.draftId, step: event.step ?? s.step, data: event.data !== undefined ? event.data : s.data });

    case 'SUBMIT':
      if ((s.status === 'draft' || s.status === 'failed') && !s.id && event.id) {
        return ok({ status: 'submitting', id: event.id, error: null });
      }
      return s;

    case 'SUCCESS':
      if (s.status === 'submitting' && s.id === event.id) {
        return ok({ status: 'confirmed' });
      }
      return s;

    case 'FAILURE':
      if (s.status === 'submitting' && s.id === event.id) {
        return ok({ status: 'failed', error: event.error || 'Commitment failed', id: null });
      }
      return s;

    case 'CANCEL':
      if (s.status === 'confirmed') return s;
      return ok({ status: 'cancelled', id: null });

    case 'RETRY':
      if (s.status === 'failed') {
        return ok({ status: 'draft', id: null, error: null });
      }
      return s;

    case 'RESUME':
      if (s.status === 'submitting' || s.status === 'confirmed') return s;
      return ok({ status: 'draft', draftId: event.draftId, step: event.step, data: event.data, id: null, error: null });

    case 'RECOVER:':
      if (s.status === 'submitting' || s.status === 'confirmed') return s;
      const from = event.from;
      if (from && typeof from === 'object') {
        const recoveredStatus = from.status === 'submitting' ? 'failed' : (from.status || 'draft');
        const recoveredError = from.status === 'submitting' ? 'recovered' : from.error;
        return ok({
          status: recoveredStatus,
          step: from.step,
          data: from.data,
          owner: from.owner ?? s.owner,
          id: null,
          error: recoveredError,
          draftId: from.draftId ?? s.draftId,
        });
      }
      return s;

    default:
      return s;
  }
}