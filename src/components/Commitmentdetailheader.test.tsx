import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CommitmentDetailHeader from './Commitmentdetailheader';

describe('CommitmentDetailHeader', () => {
  it('keeps the share action keyboard-focusable and wired to the handler', () => {
    const onBack = vi.fn();
    const onShare = vi.fn();

    render(
      <CommitmentDetailHeader
        commitmentId="Balanced Commitment #42"
        statusLabel="Active"
        statusVariant="active"
        onBack={onBack}
        onShare={onShare}
      />,
    );

    const shareButton = screen.getByRole('button', { name: 'Share commitment' });

    fireEvent.click(shareButton);

    expect(onShare).toHaveBeenCalledTimes(1);
    expect(shareButton).toHaveClass('focus-visible:ring-2');
    expect(screen.getByRole('heading', { name: 'Balanced Commitment #42' })).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});
