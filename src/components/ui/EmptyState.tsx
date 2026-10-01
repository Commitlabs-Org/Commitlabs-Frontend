import React from 'react';

export interface EmptyStateProps {
  title: string;
  description: string;
  className?: string;
  cta?: { label: string; href: string };
}

export function EmptyState({ title, description, className = '', cta }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-white/60 text-center max-w-md">{description}</p>
      {cta && (
        <a
          href={cta.href}
          className="mt-4 rounded-xl border px-5 py-2 bg-[rgba(8,12,16,0.95)] text-white hover:border-[rgba(0,212,255,0.45)]"
        >
          {cta.label}
        </a>
      )}
    </div>
  );
}
