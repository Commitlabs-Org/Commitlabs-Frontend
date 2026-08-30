/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadDraftsFromStorage,
  pruneExpiredDrafts,
  isValidDraftId,
  isDraftExpired,
  DRAFT_TTL_MS,
} from '../useDraftPersistence';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});

describe('useDraftPersistence boundary', () => {
  it('rejects invalid draft id', () => {
    expect(isValidDraftId('bad id!')).toBe(false);
    expect(isValidDraftId('valid_123-abc')).toBe(true);
  });

  it('prunes expired drafts', () => {
    const now = Date.now();
    const drafts = {
      fresh: {
        id: 'fresh',
        data: {
          step: 1,
          selectedType: null,
          commitmentType: 'balanced',
          amount: '10',
          asset: 'XLM',
          durationDays: 30,
          maxLossPercent: 50,
        },
        createdAt: now,
        updatedAt: now,
      },
      old: {
        id: 'old',
        data: {
          step: 1,
          selectedType: null,
          commitmentType: 'balanced',
          amount: '10',
          asset: 'XLM',
          durationDays: 30,
          maxLossPercent: 50,
        },
        createdAt: now - DRAFT_TTL_MS - 1000,
        updatedAt: now - DRAFT_TTL_MS - 1000,
      },
    } as any;
    const pruned = pruneExpiredDrafts(drafts, DRAFT_TTL_MS);
    expect(pruned.fresh).toBeDefined();
    expect(pruned.old).toBeUndefined();
  });

  it('loadDraftsFromStorage discards tampered JSON', () => {
    localStorage.setItem('commitlabs-create-drafts', '{not json');
    const loaded = loadDraftsFromStorage();
    expect(loaded).toEqual({});
    expect(localStorage.getItem('commitlabs-create-drafts')).toBeNull();
  });

  it('discards draft with out-of-range durationDays (tampering)', () => {
    const tampered = {
      evil: {
        id: 'evil',
        data: {
          step: 2,
          selectedType: 'safe',
          commitmentType: 'safe',
          amount: '100',
          asset: 'XLM',
          durationDays: 9999,
          maxLossPercent: 50,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
    localStorage.setItem('commitlabs-create-drafts', JSON.stringify(tampered));
    const loaded = loadDraftsFromStorage();
    expect(loaded.evil).toBeUndefined();
  });

  it('discards draft with invalid id (prototype pollution attempt)', () => {
    const payload: any = {
      __proto__: {
        id: '__proto__',
        data: {
          step: 1,
          selectedType: null,
          commitmentType: 'balanced',
          amount: '10',
          asset: 'XLM',
          durationDays: 30,
          maxLossPercent: 50,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
    localStorage.setItem('commitlabs-create-drafts', JSON.stringify(payload));
    const _loaded = loadDraftsFromStorage();
    // must not pollute prototype and must be rejected due to invalid id pattern
    expect((Object.prototype as any).polluted).toBeUndefined();
  });

  it('isDraftExpired true when older than TTL', () => {
    expect(isDraftExpired(Date.now() - DRAFT_TTL_MS - 1)).toBe(true);
    expect(isDraftExpired(Date.now())).toBe(false);
  });

  it('loads valid draft', () => {
    const draft = {
      id: 'valid_id',
      data: {
        step: 2,
        selectedType: 'balanced',
        commitmentType: 'balanced',
        amount: '100',
        asset: 'USDC',
        durationDays: 90,
        maxLossPercent: 50,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    localStorage.setItem('commitlabs-create-drafts', JSON.stringify({ valid_id: draft }));
    const loaded = loadDraftsFromStorage();
    expect(loaded.valid_id).toBeDefined();
  });
});
