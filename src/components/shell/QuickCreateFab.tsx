'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FiPlus } from 'react-icons/fi';

export function QuickCreateFab() {
  const pathname = usePathname();
  if (pathname === '/create') return null;

  return (
    <Link
      href="/create"
      aria-label="Create a commitment"
      className="fixed bottom-6 right-6 z-20 inline-flex h-14 w-14 items-center justify-center rounded-full bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-400/20 transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 motion-safe:animate-[fade-in_180ms_ease-out]"
    >
      <FiPlus aria-hidden="true" size={24} />
    </Link>
  );
}
