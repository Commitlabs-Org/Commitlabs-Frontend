'use client';

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutGrid,
  PlusCircle,
  BookOpen,
  BarChart2,
  Settings,
  Search,
  ArrowRight,
  Loader2,
} from 'lucide-react';

import { Dialog } from '@/components/ui/Dialog';
import { useDebounce } from '@/hooks/useDebounce';
import { useWallet } from '@/hooks/useWallet';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaticAction {
  kind: 'action';
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  shortcut?: string;
}

interface CommitmentResult {
  kind: 'commitment';
  commitmentId: string;
  asset: string;
  status: string;
  amount: string;
}

type PaletteItem = StaticAction | CommitmentResult;

// ─── Static navigation actions ────────────────────────────────────────────────

const STATIC_ACTIONS: StaticAction[] = [
  {
    kind: 'action',
    id: 'marketplace',
    label: 'Marketplace',
    description: 'Browse and discover commitments',
    href: '/marketplace',
    icon: <LayoutGrid size={16} aria-hidden="true" />,
  },
  {
    kind: 'action',
    id: 'create',
    label: 'Create Commitment',
    description: 'Start a new on-chain commitment',
    href: '/create',
    icon: <PlusCircle size={16} aria-hidden="true" />,
  },
  {
    kind: 'action',
    id: 'commitments',
    label: 'My Commitments',
    description: 'View your active and past commitments',
    href: '/commitments',
    icon: <BookOpen size={16} aria-hidden="true" />,
  },
  {
    kind: 'action',
    id: 'overview',
    label: 'Overview',
    description: 'Dashboard and portfolio summary',
    href: '/commitments/overview',
    icon: <BarChart2 size={16} aria-hidden="true" />,
  },
  {
    kind: 'action',
    id: 'settings',
    label: 'Settings',
    description: 'Manage your account and preferences',
    href: '/settings',
    icon: <Settings size={16} aria-hidden="true" />,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterStaticActions(query: string): StaticAction[] {
  if (!query.trim()) return STATIC_ACTIONS;
  const q = query.toLowerCase();
  return STATIC_ACTIONS.filter(
    (a) =>
      a.label.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q),
  );
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    CREATED: 'Created',
    ACTIVE: 'Active',
    SETTLED: 'Settled',
    VIOLATED: 'Violated',
    EARLY_EXIT: 'Early Exit',
  };
  return map[status] ?? status;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { address } = useWallet();

  const titleId = useId();
  const inputId = useId();
  const statusId = useId();
  const listboxId = useId();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const [commitmentResults, setCommitmentResults] = useState<CommitmentResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Reset state when palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setCommitmentResults([]);
      setSearchError(null);
      setActiveIndex(0);
    }
  }, [isOpen]);

  // Debounced commitment search
  useEffect(() => {
    const trimmed = debouncedQuery.trim();

    if (!trimmed || !address) {
      setCommitmentResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    setSearchError(null);

    const params = new URLSearchParams({
      ownerAddress: address,
      // Pass the raw query as an asset filter so the API can fuzzy-match;
      // the API also accepts partial IDs via the ownerAddress scope.
      asset: trimmed.toUpperCase(),
      pageSize: '8',
    });

    fetch(`/api/commitments/search?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        const items: CommitmentResult[] = (json?.data ?? []).map(
          (c: {
            commitmentId: string;
            asset: string;
            status: string;
            amount: string;
          }) => ({
            kind: 'commitment' as const,
            commitmentId: c.commitmentId,
            asset: c.asset,
            status: c.status,
            amount: c.amount,
          }),
        );
        setCommitmentResults(items);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSearchError(
          err instanceof Error ? err.message : 'Search unavailable',
        );
        setCommitmentResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, address]);

  // Build the full flat list of items shown in the palette
  const filteredActions = filterStaticActions(query);
  const items: PaletteItem[] = [...filteredActions, ...commitmentResults];

  // Keep activeIndex in bounds when list changes
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, items.length - 1)));
  }, [items.length]);

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const activeEl = list.querySelector<HTMLElement>('[aria-selected="true"]');
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleSelect = useCallback(
    (item: PaletteItem) => {
      const href =
        item.kind === 'action'
          ? item.href
          : `/commitments/${item.commitmentId}`;
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (items.length === 0) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setActiveIndex((i) => (i + 1) % items.length);
          break;

        case 'ArrowUp':
          event.preventDefault();
          setActiveIndex((i) => (i - 1 + items.length) % items.length);
          break;

        case 'Enter':
          event.preventDefault();
          if (items[activeIndex]) handleSelect(items[activeIndex]);
          break;

        default:
          break;
      }
    },
    [activeIndex, handleSelect, items],
  );

  // Accessible status message
  const hasCommitments = commitmentResults.length > 0;
  const showCommitmentSection = debouncedQuery.trim().length > 0 && !isSearching && !searchError;

  let statusMessage = '';
  if (!query.trim()) {
    statusMessage = `${STATIC_ACTIONS.length} navigation options available`;
  } else if (isSearching) {
    statusMessage = 'Searching commitments…';
  } else {
    const total = filteredActions.length + commitmentResults.length;
    statusMessage = `${total} result${total !== 1 ? 's' : ''} found`;
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      labelledById={titleId}
      initialFocusRef={inputRef as React.RefObject<HTMLElement>}
      backdropClassName="bg-black/75 p-4 backdrop-blur-md"
      className="w-full max-w-xl"
    >
      <div className="rounded-2xl border border-[rgba(0,212,255,0.2)] bg-[#0d1117] shadow-[0_0_60px_rgba(0,212,255,0.15)] overflow-hidden">
        {/* ── Header / Search input ─────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(0,212,255,0.1)]">
          <Search
            size={18}
            className="shrink-0 text-[rgba(0,212,255,0.6)]"
            aria-hidden="true"
          />
          <label htmlFor={inputId} id={titleId} className="sr-only">
            Command palette – search routes and commitments
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={
              items.length > 0 ? `palette-item-${activeIndex}` : undefined
            }
            aria-autocomplete="list"
            placeholder="Search routes or commitments…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-white placeholder-white/30 text-sm outline-none caret-[#00d4ff]"
            spellCheck={false}
            autoComplete="off"
          />
          {isSearching && (
            <Loader2
              size={16}
              className="shrink-0 text-[rgba(0,212,255,0.5)] animate-spin"
              aria-hidden="true"
            />
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white/30 border border-white/10 bg-white/5">
            esc
          </kbd>
        </div>

        {/* ── Live region for screen-reader announcements ───────────── */}
        <div
          id={statusId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {statusMessage}
        </div>

        {/* ── Results list ─────────────────────────────────────────── */}
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label="Command palette results"
          className="max-h-[360px] overflow-y-auto py-2 overscroll-contain"
        >
          {/* Static navigation section */}
          {filteredActions.length > 0 && (
            <>
              {debouncedQuery.trim() === '' && (
                <li
                  role="presentation"
                  className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-white/30 select-none"
                >
                  Navigation
                </li>
              )}
              {filteredActions.map((action, idx) => (
                <PaletteRow
                  key={action.id}
                  item={action}
                  index={idx}
                  isActive={activeIndex === idx}
                  onSelect={handleSelect}
                  onHover={setActiveIndex}
                />
              ))}
            </>
          )}

          {/* Commitment results section */}
          {showCommitmentSection && hasCommitments && (
            <>
              <li
                role="presentation"
                className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-white/30 select-none"
              >
                Commitments
              </li>
              {commitmentResults.map((c, idx) => (
                <PaletteRow
                  key={c.commitmentId}
                  item={c}
                  index={filteredActions.length + idx}
                  isActive={activeIndex === filteredActions.length + idx}
                  onSelect={handleSelect}
                  onHover={setActiveIndex}
                />
              ))}
            </>
          )}

          {/* Error state */}
          {searchError && (
            <li
              role="presentation"
              className="px-4 py-3 text-xs text-red-400/80"
            >
              {searchError}
            </li>
          )}

          {/* Empty state */}
          {!isSearching && items.length === 0 && query.trim() !== '' && (
            <li
              role="presentation"
              className="px-4 py-8 text-center text-sm text-white/30"
            >
              No results for &ldquo;{query}&rdquo;
            </li>
          )}

          {/* Wallet not connected hint for commitment search */}
          {debouncedQuery.trim() !== '' && !address && (
            <li
              role="presentation"
              className="px-4 pb-3 text-xs text-white/30"
            >
              Connect your wallet to search commitments
            </li>
          )}
        </ul>

        {/* ── Footer hint ──────────────────────────────────────────── */}
        <div
          aria-hidden="true"
          className="flex items-center gap-4 px-4 py-2 border-t border-[rgba(0,212,255,0.08)] text-[10px] text-white/20 select-none"
        >
          <span className="flex items-center gap-1">
            <kbd className="px-1 rounded border border-white/10 bg-white/5">↑</kbd>
            <kbd className="px-1 rounded border border-white/10 bg-white/5">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 rounded border border-white/10 bg-white/5">↵</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 rounded border border-white/10 bg-white/5">esc</kbd>
            close
          </span>
        </div>
      </div>
    </Dialog>
  );
}

// ─── PaletteRow ───────────────────────────────────────────────────────────────

interface PaletteRowProps {
  item: PaletteItem;
  index: number;
  isActive: boolean;
  onSelect: (item: PaletteItem) => void;
  onHover: (index: number) => void;
}

function PaletteRow({
  item,
  index,
  isActive,
  onSelect,
  onHover,
}: PaletteRowProps) {
  const isAction = item.kind === 'action';

  return (
    <li
      id={`palette-item-${index}`}
      role="option"
      aria-selected={isActive}
      onClick={() => onSelect(item)}
      onMouseEnter={() => onHover(index)}
      className={[
        'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors duration-100 select-none',
        isActive
          ? 'bg-[rgba(0,212,255,0.1)] text-white'
          : 'text-white/70 hover:bg-[rgba(255,255,255,0.04)]',
      ].join(' ')}
    >
      {/* Icon */}
      <span
        className={[
          'shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border text-[11px]',
          isActive
            ? 'border-[rgba(0,212,255,0.4)] bg-[rgba(0,212,255,0.12)] text-[#00d4ff]'
            : 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-white/40',
        ].join(' ')}
        aria-hidden="true"
      >
        {isAction ? (
          item.icon
        ) : (
          <span className="font-mono font-medium">{item.asset.slice(0, 2)}</span>
        )}
      </span>

      {/* Label + description */}
      <span className="flex-1 min-w-0">
        {isAction ? (
          <>
            <span className="block text-sm font-medium leading-snug truncate">
              {item.label}
            </span>
            <span className="block text-xs text-white/40 truncate">
              {item.description}
            </span>
          </>
        ) : (
          <>
            <span className="block text-sm font-medium leading-snug truncate font-mono">
              {item.commitmentId}
            </span>
            <span className="block text-xs text-white/40 truncate">
              {item.asset} · {statusLabel(item.status)} · {item.amount}
            </span>
          </>
        )}
      </span>

      {/* Arrow indicator when active */}
      {isActive && (
        <ArrowRight
          size={14}
          className="shrink-0 text-[rgba(0,212,255,0.7)]"
          aria-hidden="true"
        />
      )}
    </li>
  );
}
