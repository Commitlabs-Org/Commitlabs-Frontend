'use client';

import React from 'react';
import Link from 'next/link';

interface EmptyStateCta {
  label: string;
  href: string;
}

interface EmptyStateProps {
  title: string;
  description?: string;
  cta?: EmptyStateCta;
  icon?: React.ReactNode;
}

/**
 * EmptyState — generic empty-list / no-results placeholder.
 *
 * Accessibility: uses role="status" so screen readers announce the
 * empty state when the surrounding list becomes empty, without being
 * too aggressive (role="alert" would interrupt ongoing narration).
 */
export function EmptyState({ title, description, cta, icon }: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-label={title}
      className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center"
    >
      {icon && <div className="text-[#94A3B8]">{icon}</div>}

      <div className="flex flex-col gap-2">
        <p className="text-[18px] font-semibold text-white">{title}</p>
        {description && <p className="text-[14px] text-[#94A3B8] max-w-sm">{description}</p>}
      </div>

      {cta && (
        <Link
          href={cta.href}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#0FF0FC]/10 border border-[#0FF0FC]/30 px-4 py-2 text-sm font-medium text-[#0FF0FC] hover:bg-[#0FF0FC]/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
