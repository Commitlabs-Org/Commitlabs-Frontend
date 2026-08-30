import { describe, expect, it, vi } from 'vitest';
import { buildCommitmentScopedCommands } from './scopedActions';

describe('buildCommitmentScopedCommands', () => {
  it('creates scoped actions with stable ids and handlers', () => {
    const onSettle = vi.fn();
    const onEarlyExit = vi.fn();
    const commands = buildCommitmentScopedCommands({
      commitmentId: 'c-1',
      canSettle: true,
      canEarlyExit: true,
      onSettle,
      onEarlyExit,
    });

    expect(commands.map((command) => command.id)).toEqual([
      'commitment:c-1:settle',
      'commitment:c-1:early-exit',
      'commitment:c-1:list-for-sale',
    ]);
    commands[0].run();
    commands[1].run();
    expect(onSettle).toHaveBeenCalledOnce();
    expect(onEarlyExit).toHaveBeenCalledOnce();
  });

  it('keeps unavailable actions visible but disabled with reasons', () => {
    const [settle, earlyExit, listForSale] = buildCommitmentScopedCommands({
      commitmentId: 'c-2',
      canSettle: false,
      canEarlyExit: false,
      onSettle: vi.fn(),
      onEarlyExit: vi.fn(),
    });

    expect(settle.disabledReason).toBeTruthy();
    expect(earlyExit.disabledReason).toBeTruthy();
    expect(listForSale.disabledReason).toBeTruthy();
  });
});
