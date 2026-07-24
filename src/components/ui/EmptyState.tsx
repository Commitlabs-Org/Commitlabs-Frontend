import React from 'react'

export interface EmptyStateCTA {
  label: string
  /** Render as an anchor when provided; otherwise renders a <button>. */
  href?: string
  onClick?: () => void
  /** aria-label override for the CTA element. */
  ariaLabel?: string
}

export interface EmptyStateProps {
  /** Short headline, e.g. "No commitments found" */
  title: string
  /** Supporting sentence shown below the title. */
  description?: string
  /** Optional icon node rendered above the title. */
  icon?: React.ReactNode
  /** Optional call-to-action button or link. */
  cta?: EmptyStateCTA
  /** Additional className for the root element. */
  className?: string
}

const ctaClass =
  'mt-4 inline-block rounded-xl border border-[rgba(255,255,255,0.15)] px-6 py-3 text-[0.95rem] ' +
  'bg-[rgba(8,12,16,0.95)] text-white/90 transition-[border-color,box-shadow] duration-200 ease-[ease] ' +
  'hover:border-[rgba(0,212,255,0.45)] hover:shadow-[0_0_10px_rgba(0,212,255,0.2)] active:scale-95 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]'

export function EmptyState({ title, description, icon, cta, className = '' }: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-label={title}
      className={`flex flex-col items-center justify-center gap-3 py-14 text-center text-[#94A3B8] ${className}`}
    >
      {icon && <span aria-hidden="true">{icon}</span>}

      <p className="text-[1.05rem] font-semibold text-white">{title}</p>

      {description && <p className="text-[0.95rem] text-white/70 max-w-sm">{description}</p>}

      {cta &&
        (cta.href ? (
          <a
            href={cta.href}
            aria-label={cta.ariaLabel ?? cta.label}
            className={ctaClass}
          >
            {cta.label}
          </a>
        ) : (
          <button
            type="button"
            onClick={cta.onClick}
            aria-label={cta.ariaLabel ?? cta.label}
            className={ctaClass}
          >
            {cta.label}
          </button>
        ))}
    </div>
  )
}

export default EmptyState
