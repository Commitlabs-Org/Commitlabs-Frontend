const DEFAULT_LIMIT = 6;

export const RECENTLY_VIEWED_COMMITMENTS_KEY = 'commitlabs:recently-viewed-commitments';
export const RECENTLY_VIEWED_COMMITMENTS_LIMIT = DEFAULT_LIMIT;

type RecentlyViewedStorage = Pick<Storage, 'getItem' | 'setItem'>;

function getBrowserStorage(): RecentlyViewedStorage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export function normalizeRecentlyViewedCommitmentIds(
  ids: readonly unknown[],
  limit = RECENTLY_VIEWED_COMMITMENTS_LIMIT,
): string[] {
  const normalized: string[] = [];

  for (const id of ids) {
    if (typeof id !== 'string') {
      continue;
    }

    const trimmedId = id.trim();
    if (!trimmedId || normalized.includes(trimmedId)) {
      continue;
    }

    normalized.push(trimmedId);
    if (normalized.length >= limit) {
      break;
    }
  }

  return normalized;
}

export function readRecentlyViewedCommitmentIds(
  storage: RecentlyViewedStorage | null = getBrowserStorage(),
): string[] {
  if (!storage) {
    return [];
  }

  try {
    const rawValue = storage.getItem(RECENTLY_VIEWED_COMMITMENTS_KEY);
    if (!rawValue) {
      return [];
    }

    const parsedValue: unknown = JSON.parse(rawValue);
    return Array.isArray(parsedValue)
      ? normalizeRecentlyViewedCommitmentIds(parsedValue)
      : [];
  } catch {
    return [];
  }
}

export function writeRecentlyViewedCommitmentIds(
  ids: readonly unknown[],
  storage: RecentlyViewedStorage | null = getBrowserStorage(),
): string[] {
  const normalizedIds = normalizeRecentlyViewedCommitmentIds(ids);

  if (!storage) {
    return normalizedIds;
  }

  try {
    storage.setItem(RECENTLY_VIEWED_COMMITMENTS_KEY, JSON.stringify(normalizedIds));
  } catch {
    // localStorage can be unavailable in private browsing or strict iframe contexts.
  }

  return normalizedIds;
}

export function recordRecentlyViewedCommitment(
  commitmentId: string,
  storage: RecentlyViewedStorage | null = getBrowserStorage(),
): string[] {
  const currentIds = readRecentlyViewedCommitmentIds(storage);
  return writeRecentlyViewedCommitmentIds([commitmentId, ...currentIds], storage);
}
