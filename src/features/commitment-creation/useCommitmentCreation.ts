import { useCallback, useEffect, useReducer } from 'react';
import { reduce, DraftState } from '@/lib/draftRecovery';
import { useDraftPersistence, NamedDraft } from '@/hooks/useDraftPersistence';
import { CommitmentDraft, WizardError } from '@/types/commitment';

const STORAGE_KEY = 'commitment-wizard-state';

function loadInitialState(): DraftState {
  if (typeof window === 'undefined') return { status: 'draft' };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { status: 'draft' };
    const parsed = JSON.parse(raw) as DraftState;
    if (parsed.status === 'submitting') {
      return { ...parsed, status: 'failed', id: null, error: 'recovered' };
    }
    return parsed;
  } catch {
    return { status: 'draft' };
  }
}

function createDraftId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ?
    crypto.randomUUID() :
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useCommitmentCreation() {
  const { drafts, saveDraft, deleteDraft } = useDraftPersistence();
  const [state, dispatch] = useReducer(reduce, undefined, loadInitialState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore write errors.
    }
  }, [state]);

  const startFresh = useCallback(() => {
    const draftId = createDraftId();
    const newDraft: CommitmentDraft = {
      id: draftId,
      step: 1,
      data: {},
      updatedAt: Date.now(),
      version: 1,
    };
    saveDraft(newDraft);
    dispatch({ type: 'START', draftId, step: 1, data: {} });
  }, [saveDraft]);

  const editDraft = useCallback((draft: CommitmentDraft) => {
    saveDraft(draft);
    dispatch({ type: 'EDIT', draftId: draft.id, step: draft.step, data: draft.data });
  }, [saveDraft]);

  const submit = useCallback((id: string) => {
    dispatch({ type: 'SUBMIT', id });
  }, []);

  const confirmSuccess = useCallback((id: string, txHash: string) => {
    if (state.draftId) {
      deleteDraft(state.draftId);
    }
    dispatch({ type: 'SUCCESS', id });
  }, [state.draftId, deleteDraft]);

  const confirmFailure = useCallback((id: string, error: WizardError) => {
    dispatch({ type: 'FAILURE', id, error: error.message });
  }, []);

  const cancel = useCallback(() => dispatch({ type: 'CANCEL' }), []);
  const retry = useCallback(() => dispatch({ type: 'RETRY' }), []);

  const resumeDraft = useCallback((draftId: string) => {
    const draft = drafts.find((d: NamedDraft) => d.id === draftId);
    if (!draft) return;
    dispatch({
      type: 'RESUME',
      draftId: draft.id,
      step: draft.data.step ?? 1,
      data: draft.data,
    });
  }, [drafts]);

  const deleteDraftById = useCallback((draftId: string) => {
    deleteDraft(draftId);
    if (state.draftId === draftId) {
      dispatch({ type: 'START' });
    }
  }, [deleteDraft, state.draftId]);

  return {
    state,
    drafts,
    startFresh,
    editDraft,
    submit,
    confirmSuccess,
    confirmFailure,
    cancel,
    retry,
    resumeDraft,
    deleteDraft: deleteDraftById,
  };
}