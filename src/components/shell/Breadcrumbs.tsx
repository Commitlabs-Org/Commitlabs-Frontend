'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface BreadcrumbsProps {
  /**
   * Overrides the label for the trailing path segment -- e.g. resolving a
   * commitment id ("cmt-9f2a...") to a friendly label ("Balanced Commitment").
   * Falls back to a readable version of the raw segment when omitted.
   */
  currentLabel?: string;
}

function readableSegment(segment: string): string {
  const decoded = decodeURIComponent(segment);
  // A long opaque id (no separators) is more useful truncated than titleized.
  if (decoded.length > 12 && !/[-_\s]/.test(decoded)) {
    return `${decoded.slice(0, 8)}…`;
  }
  return decoded
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Accessible breadcrumb trail derived from the current route's path
 * segments. Renders nothing on top-level routes (0 or 1 segments) where a
 * trail adds no navigational value -- e.g. `/analytics`, `/create`.
 */
export function Breadcrumbs({ currentLabel }: BreadcrumbsProps) {
  const pathname = usePathname() ?? '';
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length < 2) return null;

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join('/')}`;
    const isLast = index === segments.length - 1;
    const label = isLast && currentLabel ? currentLabel : readableSegment(segment);
    return { href, label, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" data-testid="breadcrumbs">
      <ol className="flex items-center flex-wrap gap-1 text-sm text-[#666]">
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex items-center gap-1">
            {crumb.isLast ? (
              <span aria-current="page" className="text-white font-medium">
                {crumb.label}
              </span>
            ) : (
              <>
                <Link
                  href={crumb.href}
                  className="hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0ff0fc] rounded"
                >
                  {crumb.label}
                </Link>
                <span aria-hidden="true" className="text-[#333]">
                  /
                </span>
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
