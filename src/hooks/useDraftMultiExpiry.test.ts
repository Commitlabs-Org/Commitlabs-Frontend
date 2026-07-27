// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useDraftPersistence,
  pruneExpiredDrafts,
  migrateLegacyDraft,
  loadDraftsFromStorage,
  DRAFT_TTL_MS,
  type DraftMap,
  type DraftState,
} from './useDraftPersistence';

const MULTI_KEY = 'commitlabs-create-drafts';
const LEGACY_KEY = 'commitlabs-create-draft';

const baseDraft: DraftState = {
  step: 1,
  selectedType: 'balanced',
  commitmentType: 'balanced',
  amount: '1000',
  asset: 'XLM',
  durationDays: 30,
  maxLossPercent: 20,
};

function makeNamedDraft(id: string, overrides?: Partial<{ updatedAt: number; createdAt: number }>) {
  const now = Date.now();
  return {
    id,
    data: baseDraft,
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
  };
}

describe('pruneExpiredDrafts', () => {
  it('keeps drafts within TTL', () => {
    const now = Date.now();
    const drafts: DraftMap = {
      a: makeNamedDraft('a', { updatedAt: now - 1000 }),
    };
    expect(Object.keys(pruneExpiredDrafts(drafts, DRAFT_TTL_MS))).toHaveLength(1);
  });

  it('removes expired drafts', () => {
    const drafts: DraftMap = {
      old: makeNamedDraft('old', { updatedAt: Date.now() - DRAFT_TTL_MS - 1 }),
    };
    expect(Object.keys(pruneExpiredDrafts(drafts, DRAFT_TTL_MS))).toHaveLength(0);
  });

  it('keeps fresh and removes expired in mixed map', () => {
    const now = Date.now();
    const drafts: DraftMap = {
      fresh: makeNamedDraft('fresh', { updatedAt: now - 1000 }),
      stale: makeNamedDraft('stale', { updatedAt: now - DRAFT_TTL_MS - 1 }),
    };
    const result = pruneExpiredDrafts(drafts, DRAFT_TTL_MS);
    expect(result).toHaveProperty('fresh');
    expect(result).not.toHaveProperty('stale');
  });
});

describe('migrateLegacyDraft', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('returns null when no legacy draft', () => {
    expect(migrateLegacyDraft()).toBeNull();
  });

  it('migrates a valid legacy draft and removes legacy key', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ version: 1, data: baseDraft }));
    const result = migrateLegacyDraft();
    expect(result).not.toBeNull();
    expect(Object.values(result!)[0].data).toEqual(baseDraft);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('returns null and clears key for invalid legacy draft', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ version: 99, data: {} }));
    const result = migrateLegacyDraft();
    expect(result).toBeNull();
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('returns null and clears key for malformed JSON', () => {
    localStorage.setItem(LEGACY_KEY, 'not-json');
    const result = migrateLegacyDraft();
    expect(result).toBeNull();
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });
});

describe('loadDraftsFromStorage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('returns empty map when storage is empty', () => {
    expect(loadDraftsFromStorage()).toEqual({});
  });

  it('loads valid multi-draft map', () => {
    const drafts: DraftMap = { a: makeNamedDraft('a') };
    localStorage.setItem(MULTI_KEY, JSON.stringify(drafts));
    const result = loadDraftsFromStorage();
    expect(result).toHaveProperty('a');
  });

  it('prunes expired drafts on load', () => {
    const drafts: DraftMap = {
      fresh: makeNamedDraft('fresh'),
      expired: makeNamedDraft('expired', { updatedAt: Date.now() - DRAFT_TTL_MS - 1 }),
    };
    localStorage.setItem(MULTI_KEY, JSON.stringify(drafts));
    const result = loadDraftsFromStorage();
    expect(result).toHaveProperty('fresh');
    expect(result).not.toHaveProperty('expired');
  });

  it('clears and returns empty map for invalid schema', () => {
    localStorage.setItem(MULTI_KEY, JSON.stringify({ bad: 'data' }));
    const result = loadDraftsFromStorage();
    expect(result).toEqual({});
    expect(localStorage.getItem(MULTI_KEY)).toBeNull();
  });

  it('migrates legacy single draft when multi key absent', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ version: 1, data: baseDraft }));
    const result = loadDraftsFromStorage();
    expect(Object.keys(result)).toHaveLength(1);
    expect(Object.values(result)[0].data).toEqual(baseDraft);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });
});

describe('useDraftPersistence — multi-draft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('starts with empty drafts map', async () => {
    const { result } = renderHook(() => useDraftPersistence());
    await waitFor(() => expect(result.current.allDrafts).toHaveLength(0));
  });

  it('saves multiple drafts under different ids', async () => {
    const { result } = renderHook(() => useDraftPersistence());
    await waitFor(() => expect(result.current.allDrafts).toHaveLength(0));

    act(() => result.current.saveDraft(baseDraft, 'draft-1'));
    act(() => result.current.saveDraft({ ...baseDraft, amount: '2000' }, 'draft-2'));
    act(() => vi.advanceTimersByTime(600));

    await waitFor(() => expect(result.current.allDrafts).toHaveLength(2));

    const stored = JSON.parse(localStorage.getItem(MULTI_KEY)!);
    expect(stored).toHaveProperty('draft-1');
    expect(stored).toHaveProperty('draft-2');
  });

  it('clears a specific draft without removing others', async () => {
    const drafts: DraftMap = {
      'draft-a': makeNamedDraft('draft-a'),
      'draft-b': makeNamedDraft('draft-b'),
    };
    localStorage.setItem(MULTI_KEY, JSON.stringify(drafts));

    const { result } = renderHook(() => useDraftPersistence());
    await waitFor(() => expect(result.current.allDrafts).toHaveLength(2));

    act(() => result.current.clearDraft('draft-a'));
    await waitFor(() => expect(result.current.allDrafts).toHaveLength(1));
    expect(result.current.drafts).not.toHaveProperty('draft-a');
    expect(result.current.drafts).toHaveProperty('draft-b');
  });

  it('clearAllDrafts removes everything', async () => {
    const drafts: DraftMap = {
      x: makeNamedDraft('x'),
      y: makeNamedDraft('y'),
    };
    localStorage.setItem(MULTI_KEY, JSON.stringify(drafts));

    const { result } = renderHook(() => useDraftPersistence());
    await waitFor(() => expect(result.current.allDrafts).toHaveLength(2));

    act(() => result.current.clearAllDrafts());
    await waitFor(() => expect(result.current.allDrafts).toHaveLength(0));
    expect(localStorage.getItem(MULTI_KEY)).toBeNull();
  });

  it('resumeDraft returns correct draft by id', async () => {
    const drafts: DraftMap = {
      'target-id': makeNamedDraft('target-id'),
      other: makeNamedDraft('other'),
    };
    localStorage.setItem(MULTI_KEY, JSON.stringify(drafts));

    const { result } = renderHook(() => useDraftPersistence('target-id'));
    await waitFor(() => expect(result.current.draft).toEqual(baseDraft));
    expect(result.current.resumeDraft('target-id')).toEqual(baseDraft);
  });

  it('expired drafts are pruned on load', async () => {
    const drafts: DraftMap = {
      current: makeNamedDraft('current'),
      old: makeNamedDraft('old', { updatedAt: Date.now() - DRAFT_TTL_MS - 1 }),
    };
    localStorage.setItem(MULTI_KEY, JSON.stringify(drafts));

    const { result } = renderHook(() => useDraftPersistence());
    await waitFor(() => expect(result.current.allDrafts).toHaveLength(1));
    expect(result.current.drafts).toHaveProperty('current');
    expect(result.current.drafts).not.toHaveProperty('old');
  });

  it('migrates legacy single draft on first load', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ version: 1, data: baseDraft }));
    const { result } = renderHook(() => useDraftPersistence());
    await waitFor(() => expect(result.current.allDrafts).toHaveLength(1));
    expect(Object.values(result.current.drafts)[0].data).toEqual(baseDraft);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('allDrafts is sorted newest-updated first', async () => {
    const now = Date.now();
    const drafts: DraftMap = {
      older: makeNamedDraft('older', { updatedAt: now - 5000 }),
      newer: makeNamedDraft('newer', { updatedAt: now - 1000 }),
    };
    localStorage.setItem(MULTI_KEY, JSON.stringify(drafts));

    const { result } = renderHook(() => useDraftPersistence());
    await waitFor(() => expect(result.current.allDrafts).toHaveLength(2));
    expect(result.current.allDrafts[0].id).toBe('newer');
    expect(result.current.allDrafts[1].id).toBe('older');
  });
});
