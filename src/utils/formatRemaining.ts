export type MaturityStatus = 'healthy' | 'warning' | 'critical' | 'matured';

export interface RemainingMaturity {
  text: string;
  status: MaturityStatus;
}

export const formatRemaining = (
  maturityTimestamp: number,
  currentTimestamp: number = Date.now()
): RemainingMaturity => {
  const diffMs = maturityTimestamp - currentTimestamp;

  if (diffMs <= 0) {
    return { text: 'Matured', status: 'matured' };
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60);

  let status: MaturityStatus = 'healthy';
  const oneDayMs = 24 * 60 * 60 * 1000;
  const sevenDaysMs = 7 * oneDayMs;

  if (diffMs <= oneDayMs) {
    status = 'critical';
  } else if (diffMs <= sevenDaysMs) {
    status = 'warning';
  }

  const timeParts = [];
  if (days > 0) timeParts.push(`${days}d`);
  if (hours > 0 || days > 0) timeParts.push(`${hours}h`);
  timeParts.push(`${minutes}m`);

  return {
    text: timeParts.join(' '),
    status,
  };
};