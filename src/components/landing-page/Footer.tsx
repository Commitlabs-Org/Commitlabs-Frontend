"use client";

import React from "react";
import Link from "next/link";
import { FaTwitter, FaGithub } from "react-icons/fa";

const ForumIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M16.5832 26.6664C18.1737 27.4823 20.0032 27.7033 21.7422 27.2895C23.4812 26.8758 25.0153 25.8546 26.068 24.4099C27.1206 22.9652 27.6227 21.192 27.4837 19.4098C27.3446 17.6277 26.5737 15.9539 25.3097 14.6899C24.0457 13.4259 22.3718 12.6549 20.5897 12.5159C18.8076 12.3769 17.0344 12.8789 15.5897 13.9316C14.145 14.9843 13.1237 16.5183 12.71 18.2573C12.2963 19.9963 12.5173 21.8259 13.3332 23.4164L11.6665 28.333L16.5832 26.6664Z"
      stroke="currentColor"
      strokeWidth="1.66667"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface FooterLink {
  label: string;
  href: string;
}

interface SocialLink {
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  label: string;
  sizeClass?: string;
}

const resourceLinks: FooterLink[] = [
  { label: "Documentation", href: "#" },
  { label: "Whitepaper", href: "#" },
  { label: "GitHub", href: "https://github.com/commitlabs" },
  { label: "Blog", href: "#" },
];

const communityLinks: FooterLink[] = [
  { label: "Twitter", href: "#" },
  { label: "Discord", href: "#" },
  { label: "Telegram", href: "#" },
  { label: "Forum", href: "#" },
];

const socialLinks: SocialLink[] = [
  {
    icon: FaTwitter,
    href: "https://twitter.com/commitlabs",
    label: "Twitter",
    sizeClass: "w-5 h-5",
  },
  {
    icon: FaGithub,
    href: "https://github.com/commitlabs",
    label: "GitHub",
    sizeClass: "w-5 h-5",
  },
  {
    icon: ForumIcon,
    href: "#",
    label: "Forum",
    sizeClass: "w-10 h-10",
  },
];

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#0a0a0a] border-t border-[rgba(0,212,255,0.15)]">
      <div className="max-w-[1100px] mx-auto px-6 md:px-8 xl:px-0 pt-[49px]">
        {/* Top Section */}
        <div className="flex flex-col md:flex-row justify-between gap-10 lg:gap-[48px] pb-[72px]">
          {/* Branding */}
          <div className="flex flex-col space-y-4 md:max-w-[340px] lg:max-w-[420px]">
            <Link href="/" className="inline-flex items-center gap-3">
              <span
                className="relative grid h-[38px] w-[38px] place-items-center rounded-full border border-[#0ff0fc] bg-[rgba(8,12,16,0.95)] shadow-[0_0_14px_rgba(0,212,255,0.35)]"
                aria-hidden="true"
              >
                <span className="font-roboto text-[18px] font-normal text-white">
                  C
                </span>
              </span>
              <span className="font-roboto text-xl font-bold text-white">
                CommitLabs
              </span>
            </Link>
            <p className="font-['Inter',sans-serif] text-sm leading-6 text-[#99a1af]">
              Building core DeFi infrastructure that transforms passive
              liquidity into enforceable, attestable, and composable on-chain
              commitments.
            </p>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-row gap-12 md:gap-16 lg:gap-24">
            <nav aria-label="Resources" className="flex flex-col">
              <h3 className="font-roboto text-sm font-medium uppercase tracking-wider text-white mb-4">
                Resources
              </h3>
              <ul className="flex flex-col gap-3">
                {resourceLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="font-['Inter',sans-serif] text-sm text-[#99a1af] transition-colors duration-200 hover:text-[#0ff0fc]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Community" className="flex flex-col">
              <h3 className="font-roboto text-sm font-medium uppercase tracking-wider text-white mb-4">
                Community
              </h3>
              <ul className="flex flex-col gap-3">
                {communityLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="font-['Inter',sans-serif] text-sm text-[#99a1af] transition-colors duration-200 hover:text-[#0ff0fc]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-6 border-t border-[rgba(255,255,255,0.05)] py-6">
          <p className="font-['Inter',sans-serif] text-xs text-[#99a1af] text-center md:text-left">
            © 2026 CommitLabs. Licensed under MIT.
          </p>

          <div className="flex items-center justify-center md:justify-end gap-3">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="inline-flex items-center justify-center w-10 h-10 rounded-[10px] bg-white/5 border border-[rgba(255,255,255,0.1)] text-[#99a1af] transition-all duration-200 hover:border-[#0ff0fc] hover:text-[#0ff0fc] hover:bg-[#0ff0fc]/10"
              >
                <social.icon className={social.sizeClass} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
