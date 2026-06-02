import React from 'react';

export type SettlementState = 'eligible' | 'ineligible' | 'processing' | 'settled';

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: SettlementState;
  processingStep?: 0 | 1 | 2; // 0: Initiating, 1: Confirming on Stellar, 2: Finalizing
  ineligibleReason?: string;
  onSettlementStart?: () => void;
  onReturnToDashboard?: () => void;
  commitmentDetails?: {
    id: string;
    amount: string;
    asset: string;
  };
}

const SettlementModal: React.FC<SettlementModalProps> = ({
  isOpen,
  onClose,
  state,
  processingStep = 0,
  ineligibleReason,
  onSettlementStart,
  onReturnToDashboard,
  commitmentDetails,
}) => {
  if (!isOpen) return null;

  const steps = ['Initiating', 'Confirming on Stellar', 'Finalizing'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden transition-all animate-in fade-in zoom-in duration-300">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h2 className="text-xl font-semibold text-white">
            {state === 'settled' ? 'Settlement Complete' : 'Settle Commitment'}
          </h2>
          <button 
            onClick={onClose}
            className="p-1 text-white/40 hover:text-white transition-colors focus:outline-none"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="p-8">
          {/* ELIGIBLE STATE */}
          {state === 'eligible' && (
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-16 h-16 bg-[#00C950]/10 text-[#00C950] rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
              </div>
              <div className="space-y-2">
                <p className="text-white/60 text-sm">You are ready to settle commitment</p>
                <p className="text-lg font-mono font-bold text-white">#{commitmentDetails?.id || 'ID-UNKNOWN'}</p>
                <p className="text-3xl font-bold text-white pt-2">{commitmentDetails?.amount} <span className="text-white/40">{commitmentDetails?.asset}</span></p>
              </div>
              <button 
                onClick={onSettlementStart}
                className="w-full py-4 bg-[#00C950] hover:bg-[#00b548] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#00C950]/20 active:scale-[0.98]"
              >
                Proceed to Settle
              </button>
            </div>
          )}

          {/* INELIGIBLE STATE */}
          {state === 'ineligible' && (
            <div className="flex flex-col items-center text-center space-y-6">
              {(() => {
                const reason = ineligibleReason?.toLowerCase() || '';
                let isTemporary = false;
                let message = 'This commitment does not meet the necessary conditions for settlement at this time.';
                let iconColor = 'text-red-500';
                let bgColor = 'bg-red-500/10';
                let borderColor = 'border-red-500/20';
                let textColor = 'text-red-400';

                if (reason.includes('matured') || reason.includes('not matured')) {
                  isTemporary = true;
                  message = 'This commitment has not yet reached maturity. Please try again later.';
                  iconColor = 'text-yellow-500';
                  bgColor = 'bg-yellow-500/10';
                  borderColor = 'border-yellow-500/20';
                  textColor = 'text-yellow-400';
                } else if (reason.includes('settled') || reason.includes('already settled')) {
                  message = 'This commitment has already been settled.';
                } else if (reason.includes('disputed') || reason.includes('dispute')) {
                  message = 'This commitment is under dispute and cannot be settled at this time.';
                } else if (reason.includes('violated')) {
                  message = 'This commitment has been violated and cannot be settled.';
                } else if (reason.includes('early exit') || reason.includes('early_exit')) {
                  message = 'This commitment has already been exited early.';
                }

                return (
                  <>
                    <div className={`w-16 h-16 ${bgColor} ${iconColor} rounded-full flex items-center justify-center`}>
                      {isTemporary ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                      )}
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-lg font-bold text-white">
                        {isTemporary ? 'Not Ready Yet' : 'Ineligible for Settlement'}
                      </h3>
                      <div className={`bg-black/20 border ${borderColor} p-4 rounded-xl`}>
                        <p className={`${textColor} text-sm leading-relaxed`}>{message}</p>
                        {isTemporary && (
                          <p className="text-white/40 text-xs mt-2">
                            This is a temporary issue—you can try again once the commitment matures.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="w-full space-y-3">
                      {commitmentDetails && (
                        <a 
                          href={`/commitments/${commitmentDetails.id}`}
                          className="block w-full py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition-all"
                        >
                          View Commitment Details
                        </a>
                      )}
                      <button 
                        onClick={onReturnToDashboard || onClose}
                        className="w-full py-4 bg-white text-black font-bold rounded-xl transition-all hover:bg-gray-200 active:scale-[0.98]"
                      >
                        Return to Dashboard
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* PROCESSING STATE */}
          {state === 'processing' && (
            <div className="flex flex-col items-center space-y-10">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-white/5 border-t-[#00C950] rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-[#00C950]/10 rounded-full animate-pulse"></div>
                </div>
              </div>
              
              <div className="w-full space-y-6">
                <div className="flex justify-between items-center relative">
                  <div className="absolute top-4 left-0 right-0 h-0.5 bg-white/5"></div>
                  <div 
                    className="absolute top-4 left-0 h-0.5 bg-[#00C950] transition-all duration-700"
                    style={{ width: `${(processingStep / (steps.length - 1)) * 100}%` }}
                  ></div>
                  
                  {steps.map((label, idx) => (
                    <div key={label} className="relative z-10 flex flex-col items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-500 ${
                        idx < processingStep 
                          ? 'bg-[#00C950] border-[#00C950]' 
                          : idx === processingStep 
                            ? 'bg-[#0a0a0a] border-[#00C950] shadow-[0_0_15px_rgba(0,201,80,0.3)]' 
                            : 'bg-[#0a0a0a] border-white/10'
                      }`}>
                        {idx < processingStep ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        ) : (
                          <div className={`w-2 h-2 rounded-full ${idx === processingStep ? 'bg-[#00C950] animate-pulse' : 'bg-white/10'}`}></div>
                        )}
                      </div>
                      <span className={`text-[10px] uppercase font-bold tracking-widest ${idx === processingStep ? 'text-[#00C950]' : 'text-white/20'}`}>
                        {label.split(' ')[0]}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-center text-white/50 text-sm font-medium animate-pulse">
                  {steps[processingStep]}...
                </p>
              </div>
            </div>
          )}

          {/* SETTLED STATE (Result Summary) */}
          {state === 'settled' && (
            <div className="flex flex-col space-y-8">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 bg-[#00C950]/20 text-[#00C950] rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-bold text-white">Settlement Success</h3>
                  <p className="text-white/50 text-sm">The commitment has been successfully closed.</p>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-black">Result Summary</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-white/40 text-xs">Settled Amount</span>
                    <span className="text-white font-bold leading-none">{commitmentDetails?.amount} {commitmentDetails?.asset}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-white/40 text-xs">Transaction ID</span>
                    <span className="text-white font-mono text-[10px] truncate max-w-[150px] leading-none opacity-80">
                      {commitmentDetails?.id}
                    </span>
                  </div>
                  <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                    <span className="text-white/40 text-xs">Final Status</span>
                    <span className="px-2 py-0.5 bg-[#00C950]/10 text-[#00C950] text-[10px] font-black uppercase rounded">Settled</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  onClick={onReturnToDashboard}
                  className="w-full py-4 bg-white text-black font-bold rounded-xl transition-all hover:bg-gray-200 active:scale-[0.98]"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettlementModal;