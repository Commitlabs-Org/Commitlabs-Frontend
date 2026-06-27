'use client';

import React, { useCallback, useState } from 'react';
import { AlertTriangle, X, Info } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';

export interface CommitmentEarlyExitModalProps {
  isOpen: boolean;
  commitmentId: string;
  originalAmount: string;
  penaltyPercent: string;
  penaltyAmount: string;
  netReceiveAmount: string;
  hasAcknowledged: boolean;
  onChangeAcknowledged: (value: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
  onClose?: () => void;
}

function formatScreenReaderText(val: string): string {
  return val
    .replace(/\bXLM\b/gi, 'Stellar Lumens')
    .replace(/\bUSDC\b/gi, 'USD Coin')
    .replace(/%/g, ' percent')
    .replace(/-/g, 'minus ')
}

export default function CommitmentEarlyExitModal({
  isOpen,
  commitmentId,
  originalAmount,
  penaltyPercent,
  penaltyAmount,
  netReceiveAmount,
  hasAcknowledged,
  onChangeAcknowledged,
  onCancel,
  onConfirm,
  onClose,
}: CommitmentEarlyExitModalProps) {
  const [confirmationInput, setConfirmationInput] = useState('')
  const hasTypedConfirmation = confirmationInput.trim() === commitmentId
  const canConfirm = hasAcknowledged && hasTypedConfirmation

  const handleClose = useCallback(() => {
    (onClose ?? onCancel)();
  }, [onClose, onCancel]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      labelledById="early-exit-title"
      className="w-full sm:max-w-[520px] mt-auto sm:mt-0 bg-[#0A0A0A] border-t sm:border border-[#FF8A04]/30 rounded-t-[32px] sm:rounded-[32px] flex flex-col relative shadow-[0_0_60px_rgba(255,138,4,0.15)]"
    >
      {/* Header - Consistency with Details modal */}
      <div className="px-6 sm:px-10 py-8 flex items-start justify-between">
        <div className="flex items-center gap-5">
          <div className="w-[52px] h-[52px] sm:w-[60px] sm:h-[60px] rounded-[18px] bg-[#FF8A04]/10 border border-[#FF8A04]/20 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 sm:w-7 sm:h-7 text-[#FF8A04]" strokeWidth={2.5} />
          </div>
          <div>
            <h2 id="early-exit-title" className="text-[20px] sm:text-[24px] font-bold tracking-tight text-white leading-tight">
              Early Exit Warning
            </h2>
            <p className="text-[13px] sm:text-[14px] text-white/50 font-medium mt-1 leading-snug">
              This action is irreversible and carries penalties.
            </p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/10"
          aria-label="Close modal"
        >
          <X className="w-5 h-5 text-white/50" />
        </button>
      </div>

      {/* Content Body */}
      <div className="px-6 sm:px-10 pb-8">
        {/* Summary Table - Semantic financial breakdown for accessibility */}
        <table className="w-full text-left border-collapse mb-8" aria-label="Early exit penalty breakdown">
          <caption className="sr-only">Financial breakdown of early exit penalty and final refund amount</caption>
          <thead>
            <tr className="border-b border-white/10">
              <th scope="col" className="text-[12px] font-bold uppercase tracking-wider text-white/40 pb-3">Item</th>
              <th scope="col" className="text-[12px] font-bold uppercase tracking-wider text-white/40 pb-3 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {/* Commitment ID */}
            <tr className="border-b border-white/5">
              <th scope="row" className="py-3 text-[14px] text-white/40 font-medium">Commitment ID</th>
              <td className="py-3 text-[14px] font-mono text-white/80 font-bold text-right" aria-label={`Commitment ID ${commitmentId}`}>
                {commitmentId.slice(0, 8)}...{commitmentId.slice(-6)}
              </td>
            </tr>
            {/* Before Early Exit */}
            <tr className="border-b border-white/5">
              <th scope="row" className="py-3 text-[14px] text-white/40 font-medium">Before Early Exit (Committed Amount)</th>
              <td className="py-3 text-[14px] text-white font-bold text-right" aria-label={`Committed amount: ${formatScreenReaderText(originalAmount)}`}>
                {originalAmount}
              </td>
            </tr>
            {/* Penalty Rate */}
            <tr className="border-b border-white/5">
              <th scope="row" className="py-3 text-[14px] text-[#FF8A04]/80 font-medium">Penalty Rate</th>
              <td className="py-3 text-[14px] text-[#FF8A04] font-bold text-right" aria-label={`Penalty rate: ${formatScreenReaderText(penaltyPercent)}`}>
                {penaltyPercent}
              </td>
            </tr>
            {/* Penalty Deduction */}
            <tr className="border-b border-white/5">
              <th scope="row" className="py-3 text-[14px] text-[#FF8A04]/80 font-medium">Penalty Deduction</th>
              <td className="py-3 text-[14px] text-[#FF8A04] font-bold text-right" aria-label={`Penalty deduction: minus ${formatScreenReaderText(penaltyAmount)}`}>
                -{penaltyAmount}
              </td>
            </tr>
            {/* After Early Exit */}
            <tr>
              <th scope="row" className="py-4 text-[15px] text-white font-bold tracking-tight">After Early Exit (Net Refund)</th>
              <td className="py-4 text-[18px] text-[#0FF0FC] font-extrabold tracking-tight text-right" aria-label={`Net refund amount: ${formatScreenReaderText(netReceiveAmount)}`}>
                {netReceiveAmount}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Important Notice Block */}
        <div className="bg-[#FF8A04]/10 border border-[#FF8A04]/20 rounded-2xl p-5 mb-8 group hover:bg-[#FF8A04]/15 transition-colors">
          <div className="flex items-center gap-2.5 mb-4 text-[#FF8A04]">
            <Info className="w-4 h-4" />
            <span className="text-[13px] font-bold uppercase tracking-widest">Important consequences</span>
          </div>
          <ul className="space-y-2.5">
            {[
              'You will lose the penalty amount shown above immediately.',
              'The commitment will be recorded as an Early Exit on-chain.',
              'This action cannot be reversed or modified.',
              'You forfeit future yield and continue to hold reduced value.'
            ].map((text, i) => (
              <li key={i} className="flex items-start gap-2.5 leading-snug">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FF8A04]/40 mt-1.5 shrink-0" />
                <span className="text-[13px] text-white/70 font-medium">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Acknowledgment Checkbox */}
        <label className="flex items-start gap-4 p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl cursor-pointer hover:bg-white/[0.04] transition-all group active:scale-[0.99] mb-4">
          <div className="relative flex items-center">
            <input
              type="checkbox"
              className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-white/20 bg-white/5 transition-all checked:border-[#FF8A04] checked:bg-[#FF8A04]"
              checked={hasAcknowledged}
              onChange={(e) => onChangeAcknowledged(e.target.checked)}
            />
            <X className="absolute h-3.5 w-3.5 text-black opacity-0 peer-checked:opacity-100 left-0.5 top-0.5 pointer-events-none" strokeWidth={4} />
          </div>
          <span className="text-[14px] text-white/70 font-medium leading-snug select-none group-hover:text-white transition-colors">
            I understand this will record an early exit on-chain and deduct {penaltyPercent} from the committed amount.
          </span>
        </label>

        <div className="mb-6 rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4">
          <label htmlFor="confirmation-input" className="block text-[13px] font-semibold text-white/60 mb-2">
            Type the commitment ID to confirm
          </label>
          <input
            id="confirmation-input"
            type="text"
            value={confirmationInput}
            onChange={(e) => setConfirmationInput(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-[#050505] px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#FF8A04] focus:ring-2 focus:ring-[#FF8A04]/20"
            placeholder="Enter commitment ID exactly"
            autoComplete="off"
          />
          <p className="mt-2 text-[12px] text-white/40">
            Confirming this action requires the exact commitment ID: <span className="font-mono text-[#0FF0FC]">{commitmentId}</span>
          </p>
        </div>

        {/* Action Buttons - Standardized placement */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onCancel}
            className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-[18px] py-4 text-[15px] font-bold text-white transition-all order-2 sm:order-1 active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            disabled={!canConfirm}
            onClick={onConfirm}
            className="flex-[1.5] bg-[#FF8A04] disabled:grayscale disabled:opacity-30 hover:bg-[#FF8A04]/90 text-black rounded-[18px] py-4 text-[15px] font-bold transition-all order-1 sm:order-2 shadow-[0_0_30px_rgba(255,138,4,0.25)] active:scale-[0.98]"
          >
            Confirm Early Exit
          </button>
        </div>
      </div>
    </Dialog>
  )
}
