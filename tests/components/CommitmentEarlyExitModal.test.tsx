// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CommitmentEarlyExitModal from '@/components/CommitmentEarlyExitModal/CommitmentEarlyExitModal';

describe('CommitmentEarlyExitModal', () => {
  const defaultProps = {
    isOpen: true,
    commitmentId: 'CMT-TEST123',
    originalAmount: '50,000 XLM',
    penaltyPercent: '2%',
    penaltyAmount: '1,000 XLM',
    netReceiveAmount: '49,000 XLM',
    hasAcknowledged: false,
    onChangeAcknowledged: vi.fn(),
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    onClose: vi.fn(),
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <CommitmentEarlyExitModal {...defaultProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the modal header and informational notice when open', () => {
    render(<CommitmentEarlyExitModal {...defaultProps} />);
    
    // Header check
    expect(screen.getByText('Early Exit Warning')).toBeInTheDocument();
    expect(screen.getByText('This action is irreversible and carries penalties.')).toBeInTheDocument();
    
    // Notice check
    expect(screen.getByText('Important consequences')).toBeInTheDocument();
    expect(screen.getByText('You will lose the penalty amount shown above immediately.')).toBeInTheDocument();
  });

  describe('accessibility and semantic markup', () => {
    it('contains a semantic table with a descriptive screen-reader caption', () => {
      render(<CommitmentEarlyExitModal {...defaultProps} />);
      
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      
      // Caption check
      const caption = table.querySelector('caption');
      expect(caption).toBeInTheDocument();
      expect(caption).toHaveTextContent('Financial breakdown of early exit penalty and final refund amount');
    });

    it('has proper scope attributes on table headers for row and col structure', () => {
      render(<CommitmentEarlyExitModal {...defaultProps} />);
      
      const table = screen.getByRole('table');
      
      // Column headers
      const colHeaders = table.querySelectorAll('th[scope="col"]');
      expect(colHeaders.length).toBe(2);
      expect(colHeaders[0]).toHaveTextContent('Item');
      expect(colHeaders[1]).toHaveTextContent('Value');
      
      // Row headers
      const rowHeaders = table.querySelectorAll('th[scope="row"]');
      expect(rowHeaders.length).toBe(5);
      expect(rowHeaders[0]).toHaveTextContent('Commitment ID');
      expect(rowHeaders[1]).toHaveTextContent('Before Early Exit (Committed Amount)');
      expect(rowHeaders[2]).toHaveTextContent('Penalty Rate');
      expect(rowHeaders[3]).toHaveTextContent('Penalty Deduction');
      expect(rowHeaders[4]).toHaveTextContent('After Early Exit (Net Refund)');
    });

    it('applies accessible screen reader labels spelling out units and currency codes', () => {
      render(<CommitmentEarlyExitModal {...defaultProps} />);
      
      // Check original amount cell has aria-label spelling out XLM
      const originalAmountCell = screen.getByLabelText('Committed amount: 50,000 Stellar Lumens');
      expect(originalAmountCell).toBeInTheDocument();
      expect(originalAmountCell).toHaveTextContent('50,000 XLM');

      // Check penalty percentage cell has aria-label spelling out percent
      const penaltyPercentCell = screen.getByLabelText('Penalty rate: 2 percent');
      expect(penaltyPercentCell).toBeInTheDocument();
      expect(penaltyPercentCell).toHaveTextContent('2%');

      // Check penalty amount cell has aria-label spelling out negative prefix and XLM
      const penaltyAmountCell = screen.getByLabelText('Penalty deduction: minus 1,000 Stellar Lumens');
      expect(penaltyAmountCell).toBeInTheDocument();
      expect(penaltyAmountCell).toHaveTextContent('-1,000 XLM');

      // Check net refund cell has aria-label spelling out XLM
      const netRefundCell = screen.getByLabelText('Net refund amount: 49,000 Stellar Lumens');
      expect(netRefundCell).toBeInTheDocument();
      expect(netRefundCell).toHaveTextContent('49,000 XLM');
    });
  });

  describe('user interactions and confirmation validation', () => {
    it('disables the confirm button by default', () => {
      render(<CommitmentEarlyExitModal {...defaultProps} />);
      
      const confirmButton = screen.getByRole('button', { name: /Confirm Early Exit/i });
      expect(confirmButton).toBeDisabled();
    });

    it('triggers onChangeAcknowledged callback when clicking acknowledgment checkbox', () => {
      const onChangeAcknowledged = vi.fn();
      render(
        <CommitmentEarlyExitModal
          {...defaultProps}
          onChangeAcknowledged={onChangeAcknowledged}
        />
      );
      
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      
      expect(onChangeAcknowledged).toHaveBeenCalledWith(true);
    });

    it('enables the confirm button when both acknowledgement and commitment ID typing are satisfied', () => {
      const { rerender } = render(
        <CommitmentEarlyExitModal {...defaultProps} hasAcknowledged={false} />
      );
      
      const input = screen.getByPlaceholderText(/Enter commitment ID exactly/i);
      const confirmButton = screen.getByRole('button', { name: /Confirm Early Exit/i });
      
      // Action 1: Type the correct ID
      fireEvent.change(input, { target: { value: 'CMT-TEST123' } });
      expect(confirmButton).toBeDisabled(); // still disabled because hasAcknowledged is false
      
      // Action 2: Receive acknowledgment prop as true
      rerender(<CommitmentEarlyExitModal {...defaultProps} hasAcknowledged={true} />);
      
      // Type matching ID again since input value state is local to render lifecycle
      fireEvent.change(screen.getByPlaceholderText(/Enter commitment ID exactly/i), {
        target: { value: 'CMT-TEST123' },
      });
      
      expect(screen.getByRole('button', { name: /Confirm Early Exit/i })).not.toBeDisabled();
    });

    it('remains disabled if user typed the wrong commitment ID', () => {
      render(<CommitmentEarlyExitModal {...defaultProps} hasAcknowledged={true} />);
      
      const input = screen.getByPlaceholderText(/Enter commitment ID exactly/i);
      const confirmButton = screen.getByRole('button', { name: /Confirm Early Exit/i });
      
      fireEvent.change(input, { target: { value: 'WRONG-ID-999' } });
      
      expect(confirmButton).toBeDisabled();
    });

    it('calls onCancel or onClose when appropriate buttons are clicked', () => {
      const onCancel = vi.fn();
      const onClose = vi.fn();
      
      render(
        <CommitmentEarlyExitModal
          {...defaultProps}
          onCancel={onCancel}
          onClose={onClose}
        />
      );
      
      // Cancel button click
      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
      expect(onCancel).toHaveBeenCalled();
      
      // Close button (X) click
      fireEvent.click(screen.getByRole('button', { name: /Close modal/i }));
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onConfirm when confirm button is clicked', () => {
      const onConfirm = vi.fn();
      render(
        <CommitmentEarlyExitModal
          {...defaultProps}
          hasAcknowledged={true}
          onConfirm={onConfirm}
        />
      );
      
      const input = screen.getByPlaceholderText(/Enter commitment ID exactly/i);
      fireEvent.change(input, { target: { value: 'CMT-TEST123' } });
      
      const confirmButton = screen.getByRole('button', { name: /Confirm Early Exit/i });
      fireEvent.click(confirmButton);
      
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  describe('penalty preview calculations per risk tier', () => {
    it('asserts correct rendering and labels for Safe (2%) tier calculations', () => {
      render(
        <CommitmentEarlyExitModal
          {...defaultProps}
          originalAmount="50,000 XLM"
          penaltyPercent="2%"
          penaltyAmount="1,000 XLM"
          netReceiveAmount="49,000 XLM"
        />
      );

      // Value text matchers
      expect(screen.getByLabelText('Committed amount: 50,000 Stellar Lumens')).toHaveTextContent('50,000 XLM');
      expect(screen.getByLabelText('Penalty rate: 2 percent')).toHaveTextContent('2%');
      expect(screen.getByLabelText('Penalty deduction: minus 1,000 Stellar Lumens')).toHaveTextContent('-1,000 XLM');
      expect(screen.getByLabelText('Net refund amount: 49,000 Stellar Lumens')).toHaveTextContent('49,000 XLM');
    });

    it('asserts correct rendering and labels for Balanced (3%) tier calculations', () => {
      render(
        <CommitmentEarlyExitModal
          {...defaultProps}
          originalAmount="100,000 USDC"
          penaltyPercent="3%"
          penaltyAmount="3,000 USDC"
          netReceiveAmount="97,000 USDC"
        />
      );

      // Value text matchers
      expect(screen.getByLabelText('Committed amount: 100,000 USD Coin')).toHaveTextContent('100,000 USDC');
      expect(screen.getByLabelText('Penalty rate: 3 percent')).toHaveTextContent('3%');
      expect(screen.getByLabelText('Penalty deduction: minus 3,000 USD Coin')).toHaveTextContent('-3,000 USDC');
      expect(screen.getByLabelText('Net refund amount: 97,000 USD Coin')).toHaveTextContent('97,000 USDC');
    });

    it('asserts correct rendering and labels for Aggressive (5%) tier calculations', () => {
      render(
        <CommitmentEarlyExitModal
          {...defaultProps}
          originalAmount="250,000 XLM"
          penaltyPercent="5%"
          penaltyAmount="12,500 XLM"
          netReceiveAmount="237,500 XLM"
        />
      );

      // Value text matchers
      expect(screen.getByLabelText('Committed amount: 250,000 Stellar Lumens')).toHaveTextContent('250,000 XLM');
      expect(screen.getByLabelText('Penalty rate: 5 percent')).toHaveTextContent('5%');
      expect(screen.getByLabelText('Penalty deduction: minus 12,500 Stellar Lumens')).toHaveTextContent('-12,500 XLM');
      expect(screen.getByLabelText('Net refund amount: 237,500 Stellar Lumens')).toHaveTextContent('237,500 XLM');
    });
  });
});
