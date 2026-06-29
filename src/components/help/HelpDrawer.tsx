"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CircleHelp, Search, X } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { faqEntries, searchFaqEntries } from "@/lib/faq";

export const HelpDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => searchInputRef.current?.focus(), 120);
    }
  }, [isOpen]);

  const filteredEntries = useMemo(() => searchFaqEntries(query), [query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-[10px] border border-[rgba(0,212,255,0.2)] bg-[rgba(255,255,255,0.03)] px-3 py-[0.45rem] text-[12px] text-white/70 transition-colors duration-200 hover:border-[rgba(0,212,255,0.45)] hover:text-white focus-visible:border-[rgba(0,212,255,0.6)] focus-visible:outline-none"
        aria-label="Open help and FAQ"
      >
        <CircleHelp size={13} aria-hidden="true" />
        <span>Help</span>
      </button>

      <Dialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        labelledById="help-drawer-title"
        describedById="help-drawer-description"
        backdropClassName="justify-end bg-black/70 p-0"
        className="h-full w-full max-w-[480px] rounded-none border-l border-[rgba(0,212,255,0.18)] bg-[#060b10] p-0 shadow-[0_0_60px_rgba(0,0,0,0.45)]"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between border-b border-white/10 px-6 py-5">
            <div>
              <p id="help-drawer-description" className="text-[12px] uppercase tracking-[0.3em] text-cyan-300/80">
                Help center
              </p>
              <h2 id="help-drawer-title" className="mt-1 text-[1.15rem] font-semibold text-white">
                Help & FAQ
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full border border-white/10 p-2 text-white/70 transition hover:border-cyan-400/40 hover:text-white"
              aria-label="Close help drawer"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <label htmlFor="help-search" className="mb-2 block text-sm font-medium text-white/90">
              Search help articles
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" aria-hidden="true" />
              <input
                ref={searchInputRef}
                id="help-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search commitments, fees, disputes..."
                className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white outline-none ring-0 placeholder:text-white/35 focus:border-cyan-400/60"
              />
            </div>

            <div className="mt-5 space-y-3">
              {filteredEntries.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                  No matching questions found. Ask the community in Discord for help.
                </div>
              ) : (
                filteredEntries.map((entry) => (
                  <article key={entry.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <h3 className="text-sm font-semibold text-white">{entry.question}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/70">{entry.answer}</p>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-white/10 px-6 py-5">
            <a
              href="https://discord.gg/WV7tdYkJk"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-cyan-300 transition hover:text-cyan-200"
            >
              <CircleHelp size={16} aria-hidden="true" />
              Need more help? Join the Discord community
            </a>
          </div>
        </div>
      </Dialog>
    </>
  );
};
