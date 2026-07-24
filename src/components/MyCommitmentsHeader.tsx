'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Plus } from 'lucide-react';

interface MyCommitmentsHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  onCreateNew?: () => void;
  onExport?: () => void;
  backHref?: string;
  createHref?: string;
}

const MyCommitmentsHeader: React.FC<MyCommitmentsHeaderProps> = ({
  title = 'My Commitments',
  subtitle = 'View and manage all your liquidity commitments',
  onBack,
  onCreateNew,
  onExport,
  backHref = '/',
  createHref = '/create',
}) => {
  const handleBack = (e: React.MouseEvent) => {
    if (onBack) {
      e.preventDefault();
      onBack();
    }
  };

  const handleCreate = (e: React.MouseEvent) => {
    if (onCreateNew) {
      e.preventDefault();
      onCreateNew();
    }
  };

  return (
    <div className="w-full bg-[#0A0A0A] border-b border-[#FFFFFF1A] py-8">
      <header className="mx-auto flex items-center justify-between px-[5.5rem] max-[768px]:flex-col max-[768px]:items-start max-[768px]:gap-6 max-[768px]:px-6">
        <div className="flex flex-col gap-3">
          <Link 
            href={backHref} 
            className="flex items-center gap-2 text-[#99A1AF] text-sm transition-[color,transform] duration-200 ease-[ease] w-fit hover:text-white hover:-translate-x-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,255,255,0.5)] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0A0A0A] rounded"
            onClick={handleBack}
            aria-label="Back to Home"
          >
            <ArrowLeft size={16} />
            <span>&lt; Back to Home</span>
          </Link>
          
          <div className="flex flex-col gap-1">
            <h1 className="m-0 text-[2.5rem] font-bold leading-[1.2] text-white max-[768px]:text-[2rem] max-[480px]:text-[1.75rem]">
              {title}
            </h1>
            <p className="m-0 text-base text-[#99A1AF]">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 max-[768px]:w-full max-[768px]:flex-col">
          {onExport ? (
            <button
              type="button"
              onClick={onExport}
              className="flex items-center gap-2 rounded-[14px] border border-[#0FF0FC66] bg-[#0A0A0A] px-6 py-3 text-[14px] font-medium text-white shadow-[0_0_20px_0_#0FF0FC22] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] whitespace-nowrap hover:bg-[rgba(0,255,255,0.1)] hover:shadow-[0_0_20px_rgba(0,255,255,0.35)] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,255,255,0.5)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] max-[768px]:w-full max-[768px]:justify-center"
              aria-label="Export commitment data"
            >
              <Download size={18} color="#0FF0FC" />
              <span>Export</span>
            </button>
          ) : null}

          <Link 
            href={createHref}
            className="flex items-center gap-2 rounded-[14px] bg-[#0A0A0A] border-t border-[#0FF0FC66] px-6 py-3 text-[14px] font-medium shadow-[0_0_20px_0_#0FF0FC33] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] whitespace-nowrap hover:bg-[rgba(0,255,255,0.1)] hover:shadow-[0_0_20px_rgba(0,255,255,0.4)] hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,255,255,0.5)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] max-[768px]:w-full max-[768px]:justify-center"
            onClick={handleCreate}
            aria-label="Create New Commitment"
          >
            <Plus size={18} color='#0FF0FC' />
            <span className="bg-[linear-gradient(180deg,#F5F5F7_0%,#909091_100%)] bg-clip-text text-transparent">
              + Create New Commitment
            </span>
          </Link>
        </div>
      </header>
    </div>
  );
};

export default MyCommitmentsHeader;
