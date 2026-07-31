'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FiBarChart2, FiChevronLeft, FiHome, FiMenu, FiPlus, FiSettings } from 'react-icons/fi';

const STORAGE_KEY = 'commitlabs:sidebar-collapsed';

const navigation = [
  { href: '/', label: 'Overview', icon: FiHome },
  { href: '/analytics', label: 'Analytics', icon: FiBarChart2 },
  { href: '/create', label: 'Create commitment', icon: FiPlus },
  { href: '/settings', label: 'Settings', icon: FiSettings },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === 'true');
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed, hydrated]);

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
      </div>
    </aside>
  );
}
