// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDraftPersistence } from '../useDraftPersistence';

describe('useDraftPersistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('returns null when no draft exists', async () => {
    const { result } = renderHook(() => useDraftPersistence());
    await waitFor(() => expect(result.current.draft).toBeNull());
  });

  it('loads an existing valid draft from localStorage', async () => {
    const testDraft = {
      step: 2,
      selectedType: 'balanced' as const,
      commitmentType: 'balanced' as const,
      amount: '1000',
      asset: 'XLM',
      durationDays: 90,
      maxLossPercent: 50,
    };

    localStorage.setItem(
      'commitlabs-create-draft',
      JSON.stringify({
        version: 1,
        data: testDraft,
      })
    );

    const { result } = renderHook(() => useDraftPersistence());
    await waitFor(() => expect(result.current.draft).toEqual(testDraft));
  });

  it('ignores and clears a draft with invalid schema version', async () => {
    localStorage.setItem(
      'commitlabs-create-draft',
      JSON.stringify({
        version: 999,
        data: {},
      })
    );

    const { result } = renderHook(() => useDraftPersistence());
    await waitFor(() => expect(result.current.draft).toBeNull());
    expect(localStorage.getItem('commitlabs-create-draft')).toBeNull();
  });

  it('ignores and clears a draft with invalid data', async () => {
    localStorage.setItem(
      'commitlabs-create-draft',
      JSON.stringify({
        version: 1,
        data: {
          step: 'not a number',
        },
      })
    );

    const { result } = renderHook(() => useDraftPersistence());
    await waitFor(() => expect(result.current.draft).toBeNull());
    expect(localStorage.getItem('commitlabs-create-draft')).toBeNull();
  });

  it('saves a draft with debounce', async () => {
    const { result } = renderHook(() => useDraftPersistence());

    const testDraft = {
      step: 1,
      selectedType: 'safe' as const,
      commitmentType: 'safe' as const,
      amount: '500',
      asset: 'XLM',
      durationDays: 30,
      maxLossPercent: 20,
    };

    act(() => {
      result.current.saveDraft(testDraft);
    });

    // Before debounce, localStorage should not have it
    expect(localStorage.getItem('commitlabs-create-draft')).toBeNull();

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Now it should be saved
    expect(localStorage.getItem('commitlabs-create-draft')).not.toBeNull();
    const saved = JSON.parse(localStorage.getItem('commitlabs-create-draft')!);
    expect(saved.data).toEqual(testDraft);
  });

  it('clears a draft', async () => {
    const testDraft = {
      step: 2,
      selectedType: 'aggressive' as const,
      commitmentType: 'aggressive' as const,
      amount: '2000',
      asset: 'XLM',
      durationDays: 120,
      maxLossPercent: 100,
    };

    localStorage.setItem(
      'commitlabs-create-draft',
      JSON.stringify({
        version: 1,
        data: testDraft,
      })
    );

    const { result } = renderHook(() => useDraftPersistence());
    await waitFor(() => expect(result.current.draft).toEqual(testDraft));

    act(() => {
      result.current.clearDraft();
    });

    expect(localStorage.getItem('commitlabs-create-draft')).toBeNull();
    expect(result.current.draft).toBeNull();
  });

  it('resumeDraft returns the current draft', async () => {
    const testDraft = {
      step: 3,
      selectedType: 'balanced' as const,
      commitmentType: 'balanced' as const,
      amount: '1500',
      asset: 'XLM',
      durationDays: 60,
      maxLossPercent: 30,
    };

    localStorage.setItem(
      'commitlabs-create-draft',
      JSON.stringify({
        version: 1,
        data: testDraft,
      })
    );

    const { result } = renderHook(() => useDraftPersistence());
    await waitFor(() => expect(result.current.draft).toEqual(testDraft));

    expect(result.current.resumeDraft()).toEqual(testDraft);
  });
});
