'use client';

import React, { useState } from 'react';
import TransactionProgressModal, { TransactionState } from './TransactionProgressModal';

export default function ModalTester() {
  const [isOpen, setIsOpen] = useState(false);
  const [txState, setTxState] = useState<TransactionState>('IDLE');
  const [errorCode, setErrorCode] = useState<string>('UNKNOWN_ERROR');

  const runSuccessFlow = () => {
    setIsOpen(true);
    setTxState('AWAITING_SIGNATURE');
    setTimeout(() => setTxState('SUBMITTING'), 2000);
    setTimeout(() => setTxState('PROCESSING'), 5000);
    setTimeout(() => setTxState('SUCCESS'), 8000);
  };

  const runTimeoutFlow = () => {
    setIsOpen(true);
    setTxState('AWAITING_SIGNATURE');
    setTimeout(() => setTxState('SUBMITTING'), 1500);
    setTimeout(() => setTxState('PROCESSING'), 3500);
    setTimeout(() => {
      setErrorCode('RPC_TIMEOUT');
      setTxState('ERROR');
    }, 7000);
  };

  const runRejectFlow = () => {
    setIsOpen(true);
    setTxState('AWAITING_SIGNATURE');
    setTimeout(() => {
      setErrorCode('USER_REJECTED');
      setTxState('ERROR');
    }, 2000);
  };

  return (
    <>
      {/* Floating Action Buttons for Testing */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 bg-[#1a1a1a] p-4 rounded-xl border border-white/10 shadow-2xl">
        <h3 className="text-white/80 text-xs font-bold uppercase tracking-wider mb-1">Modal Tester</h3>
        <button onClick={runSuccessFlow} className="text-sm py-2 px-4 rounded-lg font-semibold text-white bg-[#00C950] hover:bg-[#00C950]/90 transition-colors">
          Play Success Flow
        </button>
        <button onClick={runTimeoutFlow} className="text-sm py-2 px-4 rounded-lg font-semibold text-white bg-[#FF8904] hover:bg-[#FF8904]/90 transition-colors">
          Play Timeout Flow
        </button>
        <button onClick={runRejectFlow} className="text-sm py-2 px-4 rounded-lg font-semibold text-white bg-[#FF4757] hover:bg-[#FF4757]/90 transition-colors">
          Play User Reject
        </button>
      </div>

      <TransactionProgressModal
        isOpen={isOpen}
        state={txState}
        actionName="Creating Commitment"
        errorCode={errorCode}
        txHash={(txState === 'PROCESSING' || txState === 'SUCCESS' || txState === 'ERROR') ? 'a1b2...c3d4' : undefined}
        onClose={() => {
          setIsOpen(false);
          setTimeout(() => setTxState('IDLE'), 300); // Reset after closing animation
        }}
        onRetry={runSuccessFlow}
        onSuccessAction={() => setIsOpen(false)}
      />
    </>
  );
}