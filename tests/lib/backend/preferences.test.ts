import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonFilePreferencesStore, requireWalletAuth } from '../../../src/lib/backend/preferences';
import { UnauthorizedError } from '../../../src/lib/backend/errors';
import { verifySessionToken } from '../../../src/lib/backend/auth';
import fs from 'fs/promises';

vi.mock('fs/promises');

vi.mock('../../../src/lib/backend/auth', async () => {
  const actual = await vi.importActual('../../../src/lib/backend/auth');
  return {
    ...actual,
    verifySessionToken: vi.fn(),
  };
});

describe('preferences module', () => {
  const mockAddress = 'ABC123XYZ';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('jsonFilePreferencesStore', () => {
    it('returns null when no preferences exist for address', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ preferences: {} }));
      const prefs = await jsonFilePreferencesStore.get(mockAddress);
      expect(prefs).toBeNull();
    });

    it('returns preferences when they exist for address', async () => {
      const prefs = { theme: 'dark' };
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ preferences: { [mockAddress]: prefs } }),
      );
      const result = await jsonFilePreferencesStore.get(mockAddress);
      expect(result).toEqual(prefs);
    });

    it('persists and re-reads a preference set', async () => {
      const initialDb = { preferences: {} };
      const newPrefs = { theme: 'dark', language: 'fr' };

      let currentDb = initialDb;
      vi.mocked(fs.readFile).mockImplementation(async () => JSON.stringify(currentDb));
      vi.mocked(fs.writeFile).mockImplementation(async (_p, data) => {
        currentDb = JSON.parse(data as string);
      });

      await jsonFilePreferencesStore.upsert(mockAddress, newPrefs);

      const result = await jsonFilePreferencesStore.get(mockAddress);
      expect(result).toEqual(newPrefs);
    });

    it('merges new preferences with existing ones', async () => {
      const initialDb = {
        preferences: {
          [mockAddress]: { theme: 'light', language: 'en' },
        },
      };
      let currentDb = initialDb;
      vi.mocked(fs.readFile).mockImplementation(async () => JSON.stringify(currentDb));
      vi.mocked(fs.writeFile).mockImplementation(async (_p, data) => {
        currentDb = JSON.parse(data as string);
      });

      await jsonFilePreferencesStore.upsert(mockAddress, { theme: 'dark' });

      const result = await jsonFilePreferencesStore.get(mockAddress);
      expect(result).toEqual({ theme: 'dark', language: 'en' });
    });
  });

  describe('requireWalletAuth', () => {
    it('throws UnauthorizedError if header is missing', () => {
      expect(() => requireWalletAuth(null)).toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError if header is not Bearer', () => {
      expect(() => requireWalletAuth('Basic dXNlcjpwYXNz')).toThrow(
        'Authorization header must be in format: Bearer <token>',
      );
    });

    it('throws UnauthorizedError if token is malformed', () => {
      expect(() => requireWalletAuth('Bearer malformed')).toThrow(
        'Invalid or expired session token.',
      );
    });

    it('returns address for valid session token', () => {
      vi.mocked(verifySessionToken).mockReturnValue({
        valid: true,
        address: mockAddress,
      });
      const address = requireWalletAuth('Bearer some-token');
      expect(address).toBe(mockAddress);
    });

    it('returns address from placeholder token if session verification fails', () => {
      vi.mocked(verifySessionToken).mockReturnValue({ valid: false });
      const token = `session_${mockAddress}_1234567890`;
      const address = requireWalletAuth(`Bearer ${token}`);
      expect(address).toBe(mockAddress);
    });

    it('throws UnauthorizedError if placeholder token is invalid', () => {
      vi.mocked(verifySessionToken).mockReturnValue({ valid: false });
      expect(() => requireWalletAuth('Bearer session_invalid_token')).toThrow(
        'Invalid or expired session token.',
      );
    });
  });
});
