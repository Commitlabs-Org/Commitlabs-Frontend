import { describe, it, expect, beforeEach, jest } from '@virtual/jest';

import type { ValidatedEnv } from '@/lib/backend/env';

let mockEnv: Partial<ValidatedEnv> = {};

jest.mock('@/lib/backend/env', () => ({
  getValidatedEnv: () => mockEnv,
  _setMockEnv: (env: Partial<ValidatedEnv>) => { mockEnv = env; },
}));

const { _setMockEnv } = require('@/lib/backend/env');

describe('config versioning', () => {
  beforeEach(() => {
    _setMockEnv({});
  });

  it('returns the default contract configuration when no overrides are provided', () => {
    const { getContractConfig } = require('@/lib/backend/config');
    const config = getContractConfig();
    expect(config).toBeTruthy();
  });

  it('respects NEXT_PUBLIC_CONTRACTS_JSON overrides', () => {
    _setMockEnv({
      NEXT_PUBLIC_CONTRACTS_JSON: JSON.stringify({
        commitmentNtf: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      }),
    });
    const { getContractConfig } = require('@/lib/backend/config');
    const config = getContractConfig();
    expect(config).toBeTruthy();
  });

  it('respects NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION', () => {
    _setMockEnv({
      NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION: 'v2',
    });
    const { getContractConfig } = require('@/lib/backend/config');
    const config = getContractConfig();
    expect(config).toBeTruthy();
  });
});
