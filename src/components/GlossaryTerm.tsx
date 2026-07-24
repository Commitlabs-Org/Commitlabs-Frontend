import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { Info } from 'lucide-react';
import { glossary } from '../lib/glossary';

export interface GlossaryTermProps {
  termKey: string;
  children?: ReactNode;
  className?: string;
  iconSize?: number;
}

export default function GlossaryTerm({ termKey, children, className = '', iconSize = 14 }: GlossaryTermProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  const entry = glossary[termKey.toLowerCase()];
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current && 
        !tooltipRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const tooltipId = `glossary-tooltip-${termKey.replace(/\s+/g, '-')}`;

  if (!entry) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 relative ${className}`}>
      {children}
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className="text-gray-400 hover:text-[#0ff0fc] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0ff0fc] focus:ring-offset-1 focus:ring-offset-[#0f0f10] rounded-full inline-flex align-middle"
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-label={`View definition for ${entry.term}`}
      >
        <Info size={iconSize} />
      </button>
      
      {isOpen && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[#1a1a1c] border border-white/[0.12] rounded-lg shadow-xl text-sm pointer-events-none"
        >
          <strong className="block text-[#0ff0fc] mb-1 font-medium text-left">{entry.term}</strong>
          <span className="text-gray-300 leading-relaxed text-left block font-normal">{entry.definition}</span>
          
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-solid border-t-[#1a1a1c] border-t-8 border-x-transparent border-x-8 border-b-0" />
        </div>
      )}
    </span>
  );
}
