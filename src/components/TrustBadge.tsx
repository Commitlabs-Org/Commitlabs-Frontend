'use client';

import React from 'react';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';

export type TrustLevel = 'verified' | 'unverified' | 'reputable';

interface TrustBadgeProps {
  level: TrustLevel;
  className?: string;
  showTooltip?: boolean;
}

export const TrustBadge: React.FC<TrustBadgeProps> = ({ 
  level, 
  className = '',
  showTooltip = true 
}) => {
  const getBadgeConfig = () => {
    switch (level) {
      case 'verified':
        return {
          icon: <CheckCircle className="w-3 h-3" />,
          label: 'Verified Seller',
          colorClass: 'text-[#00C950] bg-[#0f2a1d] border-[#00C95033]',
          description: 'Identity and historical performance have been verified by Commitlabs.'
        };
      case 'reputable':
        return {
          icon: <CheckCircle className="w-3 h-3 opacity-70" />,
          label: 'Top Reputation',
          colorClass: 'text-[#51A2FF] bg-[#122238] border-[#51A2FF33]',
          description: 'Seller has a high successful commitment rate and positive community feedback.'
        };
      case 'unverified':
      default:
        return {
          icon: <AlertCircle className="w-3 h-3" />,
          label: 'Self-Reported',
          colorClass: 'text-white/40 bg-white/5 border-white/10',
          description: 'This seller has not yet completed the verification process. Exercise caution.'
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <div className={`group relative inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${config.colorClass} ${className}`}>
      {config.icon}
      {config.label}
      
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 rounded-lg bg-[#1A1A1A] border border-white/10 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-[11px] normal-case tracking-normal font-medium leading-relaxed text-white/70">
          <p>{config.description}</p>
          <div className="mt-1 flex items-center gap-1 text-[9px] text-[#0FF0FC]">
            <Info className="w-2.5 h-2.5" />
            Learn about trust levels
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#1A1A1A]" />
        </div>
      )}
    </div>
  );
};
