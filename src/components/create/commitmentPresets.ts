export type CommitmentTypeId = 'safe' | 'balanced' | 'aggressive';

export interface CommitmentPreset {
  id: string;
  label: string;
  description: string;
  type: CommitmentTypeId;
  durationDays: number;
  maxLossPercent: number;
}

export const COMMITMENT_PRESETS: CommitmentPreset[] = [
  {
    id: 'conservative-90',
    label: 'Conservative 90-day',
    description: 'Safe type, 90-day lock, 2% max loss — steady yield with strong principal protection.',
    type: 'safe',
    durationDays: 90,
    maxLossPercent: 2,
  },
  {
    id: 'balanced-60',
    label: 'Balanced 60-day',
    description: 'Balanced type, 60-day lock, 8% max loss — moderate risk and yield.',
    type: 'balanced',
    durationDays: 60,
    maxLossPercent: 8,
  },
  {
    id: 'aggressive-30',
    label: 'Aggressive 30-day',
    description: 'Aggressive type, 30-day lock, 20% max loss — high yield with elevated risk.',
    type: 'aggressive',
    durationDays: 30,
    maxLossPercent: 20,
  },
];

export const SCRATCH_OPTION_ID = 'scratch';
