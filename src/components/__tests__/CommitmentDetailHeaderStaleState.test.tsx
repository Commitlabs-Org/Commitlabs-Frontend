/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CommitmentDetailHeader from '@/components/Commitmentdetailheader';

describe('CommitmentDetailHeader stale async actions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('ignores stale copy completions from earlier requests', async () => {
    let resolveFirstWrite: (() => void) | undefined;
    const writeText = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirstWrite = resolve;
          }),
      )
      .mockResolvedValue(undefined);

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(
      <CommitmentDetailHeader
        commitmentId={'C' + 'B'.repeat(55)}
        statusLabel="Active"
        statusVariant="active"
        onBack={vi.fn()}
        onShare={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy commitment ID' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy commitment ID' }));

    expect(screen.getByRole('button', { name: 'Copy commitment ID' })).toHaveTextContent('Copy ID');

    resolveFirstWrite?.();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy commitment ID' })).toHaveTextContent(
        'Copied',
      );
    });
  });
});
