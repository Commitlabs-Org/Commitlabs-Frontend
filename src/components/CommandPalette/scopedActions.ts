import type { CommandItem } from './types';

export interface CommitmentActionHandlers {
  onSettle: () => void;
  onEarlyExit: () => void;
}

export interface CommitmentActionState extends CommitmentActionHandlers {
  commitmentId: string;
  canSettle: boolean;
  canEarlyExit: boolean;
}

/** Builds the contextual commands shown while viewing one commitment. */
export function buildCommitmentScopedCommands({
  commitmentId,
  canSettle,
  canEarlyExit,
  onSettle,
  onEarlyExit,
}: CommitmentActionState): CommandItem[] {
  return [
    {
      id: `commitment:${commitmentId}:settle`,
      label: 'Settle commitment',
      group: 'Commitment actions',
      disabled: !canSettle,
      disabledReason: 'Settlement is not available for this commitment.',
      run: onSettle,
    },
    {
      id: `commitment:${commitmentId}:early-exit`,
      label: 'Early exit commitment',
      group: 'Commitment actions',
      disabled: !canEarlyExit,
      disabledReason: 'Early exit is only available before maturity.',
      run: onEarlyExit,
    },
    {
      id: `commitment:${commitmentId}:list-for-sale`,
      label: 'List commitment for sale',
      group: 'Commitment actions',
      disabled: true,
      disabledReason: 'Listing commitments for sale is not available yet.',
      run: () => undefined,
    },
  ];
}
