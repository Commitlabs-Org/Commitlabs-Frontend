'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type MouseEvent } from 'react';
import { FiBarChart2, FiChevronLeft, FiHome, FiMenu, FiPlus, FiSettings } from 'react-icons/fi';
import {
  canActivateNavItem,
  type BoundaryFailure,
  type ShellAuthInput,
} from '@/lib/shell/navigationBoundary';

const STORAGE_KEY = 'commitlabs:sidebar-collapsed';

const navigation = [
  { href: '/', label: 'Overview', icon: FiHome },
  { href: '/analytics', label: 'Analytics', icon: FiBarChart2 },
  { href: '/create', label: 'Create commitment', icon: FiPlus },
  { href: '/settings', label: 'Settings', icon: FiSettings },
] as const;

export function AppSidebar({ auth }: { auth?: ShellAuthInput }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [blockReason, setBlockReason] = useState<BoundaryFailure | null>(null);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === 'true');
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed, hydrated]);

  const handleNavClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    const decision = canActivateNavItem(href, auth ?? {});
    if (decision.ok) {
      setBlockReason(null);
      return;
    }
    event.preventDefault();
    setBlockReason(decision);
  };

  return (
    <aside
      aria-label="Application navigation"
      className={`hidden min-h-screen shrink-0 border-r border-white/10 bg-[#0a0a0b] transition-[width] md:block ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="sticky top-0 flex min-h-screen flex-col p-3">
        <button
          type="button"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
          className="mb-5 flex h-10 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
        >
          {collapsed ? <FiMenu aria-hidden="true" /> : <FiChevronLeft aria-hidden="true" />}
        </button>

        <nav aria-label="Primary" className="space-y-2">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                aria-label={collapsed ? label : undefined}
                title={collapsed ? label : undefined}
                onClick={(event) => handleNavClick(event, href)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  active ? 'bg-cyan-400/15 text-cyan-300' : 'text-white/70 hover:bg-white/10'
                }`}
              >
                <Icon aria-hidden="true" />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {blockReason ? (
          <p
            role="status"
            data-testid="shell-nav-blocked"
            data-error-code={blockReason.code}
            className="mt-4 px-2 text-xs text-amber-300"
          >
            {blockReason.message}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
