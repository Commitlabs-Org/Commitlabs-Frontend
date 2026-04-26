"use client";

import React, { useState } from "react";
import Link from "next/link";

export const Navigation: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleToggle = () => {
    setMenuOpen((open) => !open);
  };

  const handleNavClick = () => {
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(0,212,255,0.15)] bg-[#0a0a0a] backdrop-blur-lg">
      <div className="relative mx-auto max-w-[1280px] px-8 py-[1.2rem] grid grid-cols-[auto_1fr_auto] items-center gap-6 max-[900px]:flex max-[900px]:justify-between max-[900px]:gap-3 max-[600px]:px-5 max-[600px]:py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-3 font-roboto text-[20px] font-medium leading-7 tracking-[0.2px] text-white"
          onClick={handleNavClick}
        >
          <span
            className="relative grid h-[38px] w-[38px] place-items-center rounded-full border border-[rgba(0,212,255,0.85)] bg-[rgba(8,12,16,0.95)] shadow-[0_0_14px_rgba(0,212,255,0.35)]"
            aria-hidden="true"
          >
            <span className="relative z-1 grid h-full w-full place-items-center font-roboto text-[18px] font-normal leading-7 text-white">
              C
            </span>
          </span>
          <span className="text-[1.13rem] font-roboto">CommitLabs</span>
        </Link>

        <nav
          id="primary-navigation"
          aria-label="Primary"
          className={[
            "flex items-center justify-center gap-8",
            "max-[900px]:absolute max-[900px]:top-full max-[900px]:left-0 max-[900px]:right-0 max-[900px]:bg-[#0a0a0a] max-[900px]:flex-col max-[900px]:pt-5 max-[900px]:px-8 max-[900px]:pb-6 max-[900px]:gap-4 max-[900px]:border-b max-[900px]:border-[rgba(0,212,255,0.2)] max-[900px]:-translate-y-[10px] max-[900px]:opacity-0 max-[900px]:pointer-events-none max-[900px]:transition-[opacity,transform] max-[900px]:duration-300 max-[900px]:ease-[ease]",
            menuOpen
              ? "max-[900px]:opacity-100 max-[900px]:translate-y-0 max-[900px]:pointer-events-auto"
              : "",
          ].join(" ")}
        >
          <a
            href="#features"
            className="font-['Inter',sans-serif] text-[14px] font-normal leading-5 text-white/75 transition-[color,text-shadow] duration-300 ease-[ease] hover:text-white hover:[text-shadow:0_0_12px_rgba(0,212,255,0.5)] focus-visible:text-white focus-visible:[text-shadow:0_0_12px_rgba(0,212,255,0.5)]"
            aria-current="page"
            onClick={handleNavClick}
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="font-['Inter',sans-serif] text-[14px] font-normal leading-5 text-white/75 transition-[color,text-shadow] duration-300 ease-[ease] hover:text-white hover:[text-shadow:0_0_12px_rgba(0,212,255,0.5)] focus-visible:text-white focus-visible:[text-shadow:0_0_12px_rgba(0,212,255,0.5)]"
            onClick={handleNavClick}
          >
            How it works
          </a>
          <a
            href="#benefits"
            className="font-['Inter',sans-serif] text-[14px] font-normal leading-5 text-white/75 transition-[color,text-shadow] duration-300 ease-[ease] hover:text-white hover:[text-shadow:0_0_12px_rgba(0,212,255,0.5)] focus-visible:text-white focus-visible:[text-shadow:0_0_12px_rgba(0,212,255,0.5)]"
            onClick={handleNavClick}
          >
            Benefits
          </a>
          <Link
            href="/settings"
            className="font-['Inter',sans-serif] text-[14px] font-normal leading-5 text-white/75 transition-[color,text-shadow] duration-300 ease-[ease] hover:text-white hover:[text-shadow:0_0_12px_rgba(0,212,255,0.5)] focus-visible:text-white focus-visible:[text-shadow:0_0_12px_rgba(0,212,255,0.5)]"
            onClick={handleNavClick}
          >
            Settings
          </Link>
          <Link
            href="/create"
            className="hidden w-auto justify-center mt-[0.4rem] rounded-[14px] border border-[rgba(0,212,255,0.6)] bg-[rgba(5,10,14,0.9)] px-6 py-[0.7rem] font-roboto text-[14px] font-medium leading-5 text-white shadow-[0_0_14px_rgba(0,212,255,0.45)] transition-[box-shadow,transform] duration-300 ease-[ease] hover:shadow-[0_0_22px_rgba(0,212,255,0.7)] hover:-translate-y-px focus-visible:shadow-[0_0_22px_rgba(0,212,255,0.7)] focus-visible:-translate-y-px max-[900px]:inline-flex max-[600px]:px-[1.1rem] max-[600px]:py-[0.6rem] max-[600px]:text-[0.9rem]"
            onClick={handleNavClick}
          >
            Get Started
          </Link>
        </nav>

        <div className="flex items-center gap-3 justify-self-end">
          <Link
            href="/create"
            className="inline-flex items-center justify-center whitespace-nowrap rounded-[14px] border border-[rgba(0,212,255,0.6)] bg-[rgba(5,10,14,0.9)] w-[133.5px] h-[45px] px-[20.56px] py-[13.89px] font-roboto text-[14px] font-medium leading-5 text-white shadow-[0_0_14px_rgba(0,212,255,0.45)] transition-[box-shadow,transform] duration-300 ease-[ease] hover:shadow-[0_0_22px_rgba(0,212,255,0.7)] hover:-translate-y-px focus-visible:shadow-[0_0_22px_rgba(0,212,255,0.7)] focus-visible:-translate-y-px max-[900px]:hidden max-[600px]:px-[1.1rem] max-[600px]:py-[0.6rem] max-[600px]:text-[0.9rem]"
          >
            Get Started
          </Link>

          <button
            type="button"
            className="hidden items-center justify-center flex-col cursor-pointer bg-transparent border border-[rgba(0,212,255,0.3)] rounded-[10px] p-[0.6rem] max-[900px]:inline-flex"
            onClick={handleToggle}
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            aria-label={
              menuOpen ? "Close navigation menu" : "Open navigation menu"
            }
          >
            <span
              className={[
                "block w-5 h-[2px] bg-[#d7f9ff] rounded-[2px] transition-[transform,opacity] duration-300 ease-[ease]",
                menuOpen ? "translate-y-[6px] rotate-45" : "",
              ].join(" ")}
            />
            <span
              className={[
                "mt-1 block w-5 h-[2px] bg-[#d7f9ff] rounded-[2px] transition-[transform,opacity] duration-300 ease-[ease]",
                menuOpen ? "opacity-0" : "",
              ].join(" ")}
            />
            <span
              className={[
                "mt-1 block w-5 h-[2px] bg-[#d7f9ff] rounded-[2px] transition-[transform,opacity] duration-300 ease-[ease]",
                menuOpen ? "-translate-y-[6px] -rotate-45" : "",
              ].join(" ")}
            />
          </button>
        </div>
      </div>
    </header>
  );
};
