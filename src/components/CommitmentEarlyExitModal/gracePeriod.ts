export const DAY_MS = 24 * 60 * 60 * 1000;

export type GraceCountdownState = 'loading' | 'no_grace' | 'pre_grace' | 'in_grace';

export interface GraceCountdownStatus {
  state: GraceCountdownState;
  title: string;
  detail: string;
  countdownLabel?: string;
  targetDate?: Date;
}

export function normalizeGracePeriodDays(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

export function getGracePeriodStartDate(maturityDate: Date, gracePeriodDays: number): Date {
  return new Date(maturityDate.getTime() - normalizeGracePeriodDays(gracePeriodDays) * DAY_MS);
}

export function formatGraceCountdown(msUntilTarget: number, reducedMotion = false): string {
  const safeMs = Math.max(0, msUntilTarget);
  if (safeMs <= 0) {
    return 'now';
  }

  const totalSeconds = Math.ceil(safeMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (reducedMotion) {
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return minutes > 0 ? `${minutes}m` : 'less than 1m';
  }

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function getGraceCountdownStatus({
  gracePeriodDays,
  maturityDate,
  now,
  reducedMotion = false,
}: {
  gracePeriodDays: number | null;
  maturityDate: Date;
  now: Date;
  reducedMotion?: boolean;
}): GraceCountdownStatus {
  if (gracePeriodDays === null) {
    return {
      state: 'loading',
      title: 'Checking grace period',
      detail: 'Loading protocol timing before calculating the early-exit grace window.',
    };
  }

  const normalizedGraceDays = normalizeGracePeriodDays(gracePeriodDays);
  if (normalizedGraceDays === 0) {
    return {
      state: 'no_grace',
      title: 'Penalty applies now',
      detail: 'This protocol configuration has no penalty-free grace period. Early exit uses the penalty shown below.',
    };
  }

  const graceStartsAt = getGracePeriodStartDate(maturityDate, normalizedGraceDays);
  if (now.getTime() >= graceStartsAt.getTime()) {
    return {
      state: 'in_grace',
      title: 'Penalty-free grace period',
      detail: `You are inside the ${normalizedGraceDays}-day grace period. Early exit is penalty-free until maturity.`,
      targetDate: maturityDate,
    };
  }

  const countdownLabel = formatGraceCountdown(
    graceStartsAt.getTime() - now.getTime(),
    reducedMotion,
  );

  return {
    state: 'pre_grace',
    title: 'Grace window opens in',
    detail: `Penalty applies now. Wait ${countdownLabel} to enter the ${normalizedGraceDays}-day penalty-free grace period.`,
    countdownLabel,
    targetDate: graceStartsAt,
  };
}
