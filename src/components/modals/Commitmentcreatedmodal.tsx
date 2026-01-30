'use client';

import React, { useEffect, useRef } from 'react';
import { CheckCircle2, Eye, ExternalLink, X } from 'lucide-react';

interface CommitmentCreatedModalProps {
    isOpen: boolean;
    commitmentId: string;
    onViewCommitment: () => void;
    onCreateAnother: () => void;
    onClose: () => void;
    onViewOnExplorer?: () => void;
}

export default function CommitmentCreatedModal({
    isOpen,
    commitmentId,
    onViewCommitment,
    onCreateAnother,
    onClose,
    onViewOnExplorer,
}: CommitmentCreatedModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const primaryButtonRef = useRef<HTMLButtonElement>(null);

    // Handle Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';

            // Focus primary button when modal opens
            setTimeout(() => {
                primaryButtonRef.current?.focus();
            }, 100);
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    // Handle click outside
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Focus trap
    const handleTabKey = (e: KeyboardEvent) => {
        if (!modalRef.current) return;

        const focusableElements = modalRef.current.querySelectorAll(
            'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement?.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement?.focus();
            }
        }
    };

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleTabKey as EventListener);
        }
        return () => {
            document.removeEventListener('keydown', handleTabKey as EventListener);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 animate-in fade-in duration-200"
            onClick={handleBackdropClick}
            role="presentation"
        >
            <div
                ref={modalRef}
                className="relative w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] rounded-3xl p-6 sm:p-10 border border-[#0FF0FC]/20 shadow-[0_0_40px_rgba(15,240,252,0.3),0_20px_60px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-4 duration-300"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                aria-describedby="modal-description"
                style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(15,240,252,0.3) rgba(255,255,255,0.05)'
                }}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 text-[#666] hover:text-[#0FF0FC] hover:bg-[#0FF0FC]/10 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#0FF0FC]/30"
                    aria-label="Close modal"
                >
                    <X size={20} />
                </button>

                {/* Success Icon */}
                <div className="flex justify-center mb-6">
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full border-3 border-[#0FF0FC] flex items-center justify-center animate-pulse-slow shadow-[0_0_30px_rgba(15,240,252,0.4),inset_0_0_20px_rgba(15,240,252,0.1)]"
                        style={{
                            background: 'radial-gradient(circle, rgba(15,240,252,0.15) 0%, transparent 70%)'
                        }}
                    >
                        <CheckCircle2 className="text-[#0FF0FC] drop-shadow-[0_0_10px_rgba(15,240,252,0.5)]" size={40} />
                    </div>
                </div>

                {/* Title & Subtitle */}
                <div className="text-center mb-6 sm:mb-8">
                    <h2 id="modal-title" className="text-2xl sm:text-3xl font-bold text-[#f5f5f7] mb-3 tracking-tight">
                        Commitment Created!
                    </h2>
                    <p id="modal-description" className="text-sm sm:text-base text-[#99a1af] leading-relaxed max-w-md mx-auto">
                        Your liquidity commitment has been successfully created and is now active
                    </p>
                </div>

                {/* Commitment ID Section */}
                <div className="text-center mb-6 sm:mb-8">
                    <span className="block text-xs sm:text-sm text-[#666] uppercase tracking-wider font-medium mb-3">
                        Commitment ID
                    </span>
                    <div className="inline-flex items-center justify-center bg-[#0FF0FC]/10 border border-[#0FF0FC]/30 rounded-xl px-4 sm:px-6 py-3 shadow-[0_0_20px_rgba(15,240,252,0.15)]">
                        <span className="font-mono text-base sm:text-lg font-semibold text-[#0FF0FC] tracking-wider">
                            {commitmentId}
                        </span>
                    </div>
                </div>

                {/* Next Steps */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
                    <h3 className="text-xs sm:text-sm font-semibold text-[#f5f5f7] uppercase tracking-wider mb-4">
                        Next Steps:
                    </h3>
                    <ul className="space-y-3">
                        <li className="flex items-start gap-3">
                            <div className="flex-shrink-0 text-[#0FF0FC] mt-0.5">
                                <CheckCircle2 size={16} />
                            </div>
                            <span className="text-sm sm:text-[15px] text-[#99a1af] leading-relaxed">
                                Your commitment is active and earning yield
                            </span>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="flex-shrink-0 text-[#0FF0FC] mt-0.5">
                                <CheckCircle2 size={16} />
                            </div>
                            <span className="text-sm sm:text-[15px] text-[#99a1af] leading-relaxed">
                                Monitor compliance and performance in your dashboard
                            </span>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="flex-shrink-0 text-[#0FF0FC] mt-0.5">
                                <CheckCircle2 size={16} />
                            </div>
                            <span className="text-sm sm:text-[15px] text-[#99a1af] leading-relaxed">
                                Trade your commitment NFT in the marketplace
                            </span>
                        </li>
                    </ul>
                </div>

                {/* Primary Action */}
                <button
                    ref={primaryButtonRef}
                    onClick={onViewCommitment}
                    className="w-full flex items-center justify-center gap-3 bg-[#0FF0FC]/10 border-2 border-[#0FF0FC] rounded-xl px-6 py-3 sm:py-4 text-base font-semibold text-[#0FF0FC] hover:bg-[#0FF0FC]/15 hover:shadow-[0_0_30px_rgba(15,240,252,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all focus:outline-none focus:ring-2 focus:ring-[#0FF0FC]/30 shadow-[0_0_20px_rgba(15,240,252,0.2)] mb-4"
                >
                    <Eye size={20} />
                    View Commitment
                </button>

                {/* Secondary Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    <button
                        onClick={onCreateAnother}
                        className="flex items-center justify-center bg-white/[0.03] border border-white/10 rounded-xl px-5 py-3 text-sm sm:text-[15px] font-medium text-[#f5f5f7] hover:bg-white/[0.05] hover:border-[#0FF0FC]/30 hover:text-[#0FF0FC] transition-all focus:outline-none focus:ring-2 focus:ring-[#0FF0FC]/20"
                    >
                        Create Another
                    </button>
                    <button
                        onClick={onClose}
                        className="flex items-center justify-center bg-white/[0.03] border border-white/10 rounded-xl px-5 py-3 text-sm sm:text-[15px] font-medium text-[#f5f5f7] hover:bg-white/[0.05] hover:border-[#0FF0FC]/30 hover:text-[#0FF0FC] transition-all focus:outline-none focus:ring-2 focus:ring-[#0FF0FC]/20"
                    >
                        Close
                    </button>
                </div>

                {/* Footer Link */}
                {onViewOnExplorer && (
                    <button
                        onClick={onViewOnExplorer}
                        className="flex items-center justify-center gap-2 mx-auto text-sm text-[#666] hover:text-[#0FF0FC] transition-colors py-2"
                    >
                        View on Stellar Explorer
                        <ExternalLink size={14} />
                    </button>
                )}
            </div>

            <style jsx>{`
                @keyframes pulse-slow {
                    0%, 100% {
                        box-shadow: 0 0 30px rgba(15,240,252,0.4), inset 0 0 20px rgba(15,240,252,0.1);
                    }
                    50% {
                        box-shadow: 0 0 40px rgba(15,240,252,0.6), inset 0 0 30px rgba(15,240,252,0.2);
                    }
                }
                .animate-pulse-slow {
                    animation: pulse-slow 2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}