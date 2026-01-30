'use client';

import React, { useEffect, useRef } from 'react';
import { Eye, ExternalLink, ArrowRight, CheckCircle, CheckCircleIcon } from 'lucide-react';

interface CommitmentCreatedModalProps {
  isOpen: boolean;
  commitmentId: string;
  onViewCommitment: () => void;
  onCreateAnother: () => void;
  onClose: () => void;
  onViewOnExplorer?: () => void;
}

export const CommitmentCreatedModal: React.FC<CommitmentCreatedModalProps> = ({
  isOpen,
  commitmentId,
  onViewCommitment,
  onCreateAnother,
  onClose,
  onViewOnExplorer,
}) => {
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
      
      
      if (e.key === 'Tab' && isOpen && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      setTimeout(() => primaryButtonRef.current?.focus(), 100);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div 
          ref={modalRef}
          className="relative w-full max-w-2xl bg-[#0A0B0E] border border-teal-500/20 rounded-3xl shadow-[0_0_50px_-10px_rgba(20,184,166,0.3)] p-6 md:p-8 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          
          <div className="mb-6 flex items-center justify-center w-20 h-20 rounded-full bg-teal-500/10 border-2 border-teal-500 shadow-[0_0_25px_rgba(20,184,166,0.4)]">
            <CheckCircle className="w-10 h-10 text-[#0FF0FC]" strokeWidth={3} />
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">
            Commitment Created!
          </h2>
          <p className="text-[#99A1AF] text-sm md:text-base leading-relaxed mb-8 max-w-sm">
            Your liquidity commitment has been successfully created and is now active
          </p>

          
          <div className="w-full bg-[#0FF0FC0D] border border-white/5 rounded-2xl p-6 mb-8 flex flex-col items-center gap-2">
            <span className="text-xs font-medium text-[#99A1AF] uppercase tracking-widest">
              Commitment ID
            </span>
            <div className="px-6 py-2.5  rounded-lg shadow-inner">
              <span className="font-mono text-xl text-[#0FF0FC] tracking-wider font-semibold">
                {commitmentId}
              </span>
            </div>
          </div>

          
          <div className="w-full mb-8 text-left">
            <h3 className="text-sm font-bold text-white mb-4">Next Steps:</h3>
            <ul className="space-y-3">
              <ListItem text="Your commitment is now active and earning yield" />
              <ListItem text="Monitor compliance and performance in your dashboard" />
              <ListItem text="You can trade this commitment NFT in the marketplace" />
            </ul>
          </div>

          {/* Actions */}
          <div className="w-full space-y-4">
            <button
              ref={primaryButtonRef}
              onClick={onViewCommitment}
              className="group w-full py-4 bg-[#0D0F12] hover:bg-[#13161B] text-white border border-teal-500/60 rounded-xl font-bold flex items-center justify-center gap-3 transition-all duration-300 shadow-[0_0_20px_rgba(20,184,166,0.2)] hover:shadow-[0_0_30px_rgba(20,184,166,0.4)] hover:border-[#0FF0FC]"
            >
              <Eye className="w-5 h-5 text-[#0FF0FC] group-hover:text-teal-300" />
              View Commitment
            </button>

            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onCreateAnother}
                className="py-3 px-4 bg-[#15171C] hover:bg-[#1E2128] text-white hover:text-white border border-white/5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                Create Another
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="py-3 px-4 bg-[#15171C] hover:bg-[#1E2128] text-white hover:text-white border border-white/5 rounded-xl text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>

          
          {onViewOnExplorer && (
            <button
              onClick={onViewOnExplorer}
              className="mt-6 flex items-center gap-2 text-xs text-[#99A1AF] hover:text-teal-400 transition-colors"
            >
              <span>View on Stellar Explorer</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper component for list items
const ListItem = ({ text }: { text: string }) => (
  <li className="flex items-start gap-3">
    <CheckCircleIcon className="w-5 h-5 text-[#0FF0FC] shrink-0 mt-0.5" />
    <span className="text-[#D1D5DC] text-sm leading-snug">{text}</span>
  </li>
);