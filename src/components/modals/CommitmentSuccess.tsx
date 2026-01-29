'use client';

import React, { useEffect, useRef } from 'react';
import { Eye, ExternalLink, CheckCircle, ArrowRight } from 'lucide-react';

interface CommitmentCreatedModalProps {
    isOpen: boolean;
    commitmentId: string;
    onViewCommitment: () => void;
    onCreateAnother: () => void;
    onClose: () => void;
    onViewOnExplorer?: () => void;
}

export const CommitmentSuccessModal: React.FC<CommitmentCreatedModalProps> = ({
    isOpen,
    commitmentId,
    onViewCommitment,
    onCreateAnother,
    onClose,
    onViewOnExplorer,
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const primaryButtonRef = useRef<HTMLButtonElement>(null);

    // Focus trap and keyboard handling
    useEffect(() => {
        if (!isOpen) return;

        setTimeout(() => {
            primaryButtonRef.current?.focus();
        }, 100);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();

            if (e.key === 'Tab' && modalRef.current) {
                const focusableElements = modalRef.current.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                const firstElement = focusableElements[0] as HTMLElement;
                const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        lastElement?.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        firstElement?.focus();
                        e.preventDefault();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const nextSteps = [
        'Your commitment is now active and earning yield',
        'Monitor compliance and performance in your dashboard',
        'You can trade this commitment NFT in the marketplace',
    ];

    // Truncate commitment ID for mobile
    const truncateCommitmentId = (id: string) => {
        if (typeof window !== 'undefined' && window.innerWidth < 640) {
            return `${id.slice(0, 8)}...${id.slice(-6)}`;
        }
        return id;
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0A0A0A]/80 backdrop-blur-sm animate-fadeIn overflow-y-auto"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div className="flex items-center justify-center min-h-screen sm:min-h-fit w-full">
                <div
                    ref={modalRef}
                    className="relative w-full bg-[#0a0909] max-w-[95vw] sm:max-w-125 lg:max-w-125 rounded-xl sm:rounded-2xl shadow-[0_0_0_1px_rgba(45,212,191,0.1),0_0_60px_rgba(45,212,191,0.25),0_20px_60px_rgba(0,0,0,0.5)] animate-slideUp my-4 sm:my-0 max-h-[95vh] sm:max-h-[95vh] overflow-y-auto"
                >
                    <div className="px-4 sm:px-6 md:px-8 lg:px-10 pt-6 sm:pt-8 md:pt-10 lg:pt-12 pb-6 sm:pb-8 md:pb-10">
                        {/* Success Icon - Fixed to stay visible */}
                        <div className="flex justify-center mb-6 sm:mb-8 sticky top-0 bg-[#0a0909] pt-4 pb-2 sm:pt-0 sm:pb-0 sm:relative sm:bg-transparent">
                            <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-25 lg:h-25">
                                {/* BLUR BACKGROUND LAYER */}
                                <div className="absolute inset-0 bg-[#0FF0FC] opacity-30 blur-xl sm:blur-2xl rounded-full"></div>

                                {/* MAIN CIRCLE */}
                                <div className="relative w-full h-full rounded-full border-2 border-[#0FF0FC] bg-[#0FF0FC]/10 flex items-center justify-center z-10">
                                    <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-[#0FF0FC] shadow-2xl shadow-[#0FF0FC]" strokeWidth={2.5} />
                                </div>
                            </div>
                        </div>

                        {/* Title Section */}
                        <div className="text-center mb-6 sm:mb-8">
                            <h2 id="modal-title" className="text-2xl sm:text-3xl md:text-[30px] font-bold text-white mb-2 sm:mb-3 tracking-tight leading-tight">
                                Commitment Created!
                            </h2>
                            <p className="text-sm sm:text-base text-[#99A1AF] font-medium sm:font-semibold leading-relaxed px-2 sm:px-0">
                                Your liquidity commitment has been successfully created and is now active
                            </p>
                        </div>

                        {/* Commitment ID Section */}
                        <div className="bg-[#0FF0FC]/5 border border-[#0FF0FC]/20 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 md:py-5 mb-6 sm:mb-8">
                            <div className="text-xs sm:text-sm md:text-base text-[#99A1AF] text-center mb-1.5 sm:mb-2.5">
                                Commitment ID
                            </div>
                            <div className="text-center overflow-x-auto">
                                <span className="font-mono text-sm sm:text-base md:text-lg font-semibold text-[#0FF0FC] tracking-wider whitespace-nowrap">
                                    {truncateCommitmentId(commitmentId)}
                                </span>
                            </div>
                        </div>

                        {/* Next Steps Section */}
                        <div className="mb-6 sm:mb-8">
                            <h3 className="text-xs sm:text-sm font-semibold text-white mb-3 sm:mb-4">Next Steps:</h3>
                            <ul className="space-y-2 sm:space-y-3">
                                {nextSteps.map((step, index) => (
                                    <li key={index} className="flex items-start gap-2 sm:gap-3">
                                        <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mt-0.5 shrink-0 text-[#0FF0FC]" strokeWidth={2.5} />
                                        <span className="text-xs sm:text-sm text-[#D1D5DC] leading-relaxed">{step}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Primary Action Button */}
                        <button
                            ref={primaryButtonRef}
                            onClick={onViewCommitment}
                            className="w-full border border-[#0FF0FC] rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-center gap-2 sm:gap-2.5 text-sm sm:text-base md:text-lg font-bold bg-linear-to-r from-[#F5F5F7] to-[#909091] bg-clip-text text-transparent shadow-[0_0_40px_rgba(45,212,191,0.2)] hover:shadow-[0_0_30px_rgba(45,212,191,0.3)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0909] mb-4"
                        >
                            <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-[#0FF0FC]" />
                            View Commitment
                        </button>

                        {/* Secondary Action Buttons */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
                            <button
                                onClick={onCreateAnother}
                                className="bg-[#161616] border border-white/10 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3.5 flex items-center justify-center gap-1.5 text-xs sm:text-sm md:text-[15px] font-semibold text-white hover:border-white/20 hover:text-white transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1f26] order-2 sm:order-1"
                            >
                                Create Another
                                <ArrowRight className='w-4 h-4 sm:w-5 sm:h-5' />
                            </button>
                            <button
                                onClick={onClose}
                                className="bg-[#161616] border border-white/10 rounded-xl sm:rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3.5 text-xs sm:text-sm md:text-[15px] text-white font-semibold hover:border-white/20 hover:text-white transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1f26] order-1 sm:order-2"
                            >
                                Close
                            </button>
                        </div>

                        {/* Footer Link */}
                        {onViewOnExplorer && (
                            <>
                                <div className="border-t border-[#0FF0FC]/20 my-4 sm:my-6"></div>
                                <button
                                    onClick={onViewOnExplorer}
                                    className="w-full flex items-center justify-center gap-1.5 text-xs sm:text-sm text-gray-400 hover:text-teal-400 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1f26] rounded-md py-2"
                                >
                                    View on Stellar Explorer
                                    <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-slideUp {
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        /* Custom scrollbar for modal */
        @media (max-height: 640px) {
          .overflow-y-auto {
            padding-top: 20px;
            padding-bottom: 20px;
          }
        }

        /* Better touch targets on mobile */
        @media (max-width: 640px) {
          button {
            min-height: 44px;
          }
        }
      `}</style>
        </div>
    );
};