// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import TransactionProgressModal from '../TransactionProgressModal';

// Mock TransactionStepTimeline so tests stay focused
vi.mock('@/components/transaction/TransactionStepTimeline', () => ({
  default: (txProps: any) => (
    <div data-testid="transaction-timeline" data-hash={txProps.txHash} data-state={txProps.state}>
      {(txProps.state === 'error' && txProps.txHash) && (
        <button
          onClick={() => txProps.onCopyHash?.(txProps.txHash)}>
            Copy hash
          </button>
      )}
    </div>
  )
}));

describe('TransactionProgressModal', () => {
  const mockOnClose = vi.fn();
  const mockOnRetry = vi.fn();
  const mockOnSuccessAction = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
    });
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <TransactionProgressModal
        isOpen={false}
        state="IDLE"
        actionName="Testing"
        onClose={mockOnClose}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when state is IDLE', () => {
    const { container } = render(
      <TransactionProgressModal
        isOpen={true}
        state="IDLE"
        actionName="Testing"
        onClose={mockOnClose}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders AWAITING_SIGNATURE state correctly', () => {
    render(
      <TransactionProgressModal
        isOpen={true}
        state="AWAITING_SIGNATURE"
        actionName="Testing Action"
        onClose={mockOnClose}
      />
    );
    expect(screen.getByText(/Confirm in Freighter/i)).toBeInTheDocument();
    expect(screen.getByText(/Please sign the transaction in your wallet./i)).toBeInTheDocument();
    const cancelButton = screen.getByText(/Cancel/i);
    fireEvent.click(cancelButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('renders SUBMITTING state correctly', () => {
    render(
      <TransactionProgressModal
        isOpen={true}
        state="SUBMITTING"
        actionName="Testing Action"
        txHash="test-hash-123"
        onClose={mockOnClose}
      />
    );
    expect(screen.getByText(/Testing Action in Progress/i)).toBeInTheDocument();
    expect(screen.getByText(/Sending to the Stellar Network.../i)).toBeInTheDocument();
  });

  it('renders PROCESSING state correctly', () => {
    render(
      <TransactionProgressModal
        isOpen={true}
        state="PROCESSING"
        actionName="Testing Action"
        txHash="test-hash-123"
        onClose={mockOnClose}
      />
    );
    expect(screen.getByText(/Confirming Transaction/i)).toBeInTheDocument();
  });

  it('renders SUCCESS state correctly', () => {
    render(
      <TransactionProgressModal
        isOpen={true}
        state="SUCCESS"
        actionName="Testing Action"
        successMessage="Custom success message"
        txHash="test-hash-123"
        onClose={mockOnClose}
        onSuccessAction={mockOnSuccessAction}
      />
    );
    expect(screen.getByText(/Testing Action Successful!/i)).toBeInTheDocument();
    expect(screen.getByText(/Custom success message/i)).toBeInTheDocument();
    const viewDetailsButton = screen.getByText(/View Details/i);
    fireEvent.click(viewDetailsButton);
    expect(mockOnSuccessAction).toHaveBeenCalled();
  });

  it('calls onClose if onSuccessAction is not provided', () => {
    render(
      <TransactionProgressModal
        isOpen={true}
        state="SUCCESS"
        actionName="Testing Action"
        onClose={mockOnClose}
      />
    );
    const viewDetailsButton = screen.getByText(/View Details/i);
    fireEvent.click(viewDetailsButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('copies transaction hash in ERROR state', async () => {
    render(
      <TransactionProgressModal
        isOpen={true}
        state="ERROR"
        actionName="Testing Action"
        errorCode="UNKNOWN_ERROR"
        txHash="test-hash-456"
        onClose={mockOnClose}
      />
    );
    const copyButton = screen.getByText(/Copy hash/i);
    await fireEvent.click(copyButton);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-hash-456');
  });

  it('handles clipboard rejection gracefully', async () => {
    (navigator.clipboard.writeText as vi.Mock).mockRejectedValueOnce(new Error('Clipboard error'));
    render(
      <TransactionProgressModal
        isOpen={true}
        state="ERROR"
        actionName="Testing Action"
        errorCode="UNKNOWN_ERROR"
        txHash="test-hash-789"
        onClose={mockOnClose}
      />
    );
    const copyButton = screen.getByText(/Copy hash/i);
    await fireEvent.click(copyButton);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-hash-789');
  });

  it('does not throw when txHash is missing', () => {
    render(
      <TransactionProgressModal
        isOpen={true}
        state="SUCCESS"
        actionName="Testing Action"
        onClose={mockOnClose}
      />
    );
    expect(screen.queryByText(/Copy hash/i)).not.toBeInTheDocument();
  });

  it('renders ERROR state correctly', () => {
    render(
      <TransactionProgressModal
        isOpen={true}
        state="ERROR"
        actionName="Testing Action"
        errorCode="USER_REJECTED"
        onClose={mockOnClose}
        onRetry={mockOnRetry}
      />
    );
    expect(screen.getByText(/Transaction Failed/i)).toBeInTheDocument();
    const tryAgainButton = screen.getByText(/Try Again/i);
    fireEvent.click(tryAgainButton);
    expect(mockOnRetry).toHaveBeenCalled();
  });

  it('renders UNKNOWN_ERROR by default', () => {
    render(
      <TransactionProgressModal
        isOpen={true}
        state="ERROR"
        actionName="Testing Action"
        onClose={mockOnClose}
        onRetry={mockOnRetry}
      />
    );
    expect(screen.getByText(/Unexpected Error/i)).toBeInTheDocument();
  });

  it('renders RPC_TIMEOUT error correctly', () => {
    render(
      <TransactionProgressModal
        isOpen={true}
        state="ERROR"
        actionName="Testing Action"
        errorCode="RPC_TIMEOUT"
        txHash="test-hash"
        onClose={mockOnClose}
      />
    );
    expect(screen.getByText(/Network Timeout/i)).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <TransactionProgressModal
        isOpen={true}
        state="AWAITING_SIGNATURE"
        actionName="Testing Action"
        onClose={mockOnClose}
      />
    );
    const closeButton = screen.getByRole('button', { name: /Close modal/i });
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });
});
