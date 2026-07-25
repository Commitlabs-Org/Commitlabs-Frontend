"use client";

import React, { useEffect, useRef, useState } from "react";

const concepts = [
  {
    title: "Liquidity Commitments",
    description:
      "Users commit liquidity under explicit rules instead of deposits without guarantees",
    bullets: [
      "Duration (30/60/90 days)",
      "Risk tolerance limits",
      "Early exit penalties",
      "Allocation constraints",
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-[30px] w-[30px]">
        <path
          d="M6.5 11V8.5a5.5 5.5 0 0 1 11 0V11"
          stroke="#0FF0FC"
          strokeWidth="2.67"
          strokeLinecap="round"
        />
        <rect
          x="4"
          y="11"
          width="16"
          height="10"
          rx="2.5"
          stroke="#0FF0FC"
          strokeWidth="2.67"
        />
      </svg>
    ),
  },
  {
    title: "Commitment NFTs",
    description: "Each commitment is minted as a transferable, composable NFT",
    bullets: [
      "Locked capital proof",
      "Commitment parameters",
      "Historical performance",
      "Attestation records",
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-[30px] w-[30px]">
        <rect
          x="3.5"
          y="4.5"
          width="17"
          height="15"
          rx="2.5"
          stroke="#0FF0FC"
          strokeWidth="2.67"
        />
        <path
          d="M7 14l3.2-3.2a1.2 1.2 0 0 1 1.7 0L16 15"
          stroke="#0FF0FC"
          strokeWidth="2.67"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="9" r="1.4" stroke="#0FF0FC" strokeWidth="2.67" />
      </svg>
    ),
  },
  {
    title: "On-Chain Attestations",
    description:
      "Continuous verification creates an immutable reliability record",
    bullets: [
      "Volatility exposure tracking",
      "Fee generation metrics",
      "Drawdown event monitoring",
      "Rule compliance checks",
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-[30px] w-[30px]">
        <path
          d="M12 3a9 9 0 1 1-9 9"
          stroke="#0FF0FC"
          strokeWidth="2.67"
          strokeLinecap="round"
        />
        <path
          d="m9.5 12.5 2.2 2.2 4.8-4.8"
          stroke="#0FF0FC"
          strokeWidth="2.67"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: "Commitment Transformation",
    description: "Reuse liquidity across protocols without withdrawal",
    bullets: [
      "Risk tranches",
      "Collateralized assets",
      "Secondary instruments",
      "Protocol guarantees",
    ],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-[30px] w-[30px]">
        <path
          d="m7 8 3-3 3 3M17 16l-3 3-3-3"
          stroke="#0FF0FC"
          strokeWidth="2.67"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 5h5a4 4 0 0 1 4 4v2"
          stroke="#0FF0FC"
          strokeWidth="2.67"
          strokeLinecap="round"
        />
        <path
          d="M14 19H9a4 4 0 0 1-4-4v-2"
          stroke="#0FF0FC"
          strokeWidth="2.67"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export const CoreConceptsSection: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-label="Core concepts"
      className="w-full bg-[#0a0a0a] py-30"
    >
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center px-6">
        <span className="rounded-full border-[0.56px] border-t-[0.56px]  bg-[#0A0A0A80] px-4 py-1 mt-4 text-[14px] leading-5 font-normal text-[#0FF0FC] font-roboto text-center">
          CORE CONCEPTS
        </span>
        <h2 className="mt-5 text-center text-[40px] leading-[45px] tracking-[0.26px] font-bold font-['Inter',sans-serif] bg-clip-text text-transparent bg-[linear-gradient(180deg,#FFFFFF_0%,#99A1AF_100%)] lg:text-[60px] lg:leading-[60px]">
          How We Transform Liquidity
        </h2>

        <div
          className={`mt-12 grid w-full grid-cols-1 gap-6 transition-all duration-700 ease-out sm:grid-cols-2 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          {concepts.map((concept) => (
            <article
              key={concept.title}
              className="group rounded-[16px] border-[0.56px] border-[#FFFFFF1A] bg-[#0A0A0ACC] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(0,0,0,0.6)]"
            >
              <div className="mb-4 flex h-[63.99px] w-[63.99px] items-center justify-center rounded-[14px] border-[0.56px] border-t-[0.56px] border-t-[#0FF0FC66] bg-[linear-gradient(180deg,rgba(15,240,252,0.2)_0%,rgba(0,0,0,0)_100%)] shadow-[0_0_20px_0_#0FF0FC4D]">
                {concept.icon}
              </div>
              <h3 className="text-[24px] leading-[32px] tracking-[0.07px] font-semibold font-['Inter',sans-serif] text-white">
                {concept.title}
              </h3>
              <p className="mt-2 text-[16px] leading-[26px] tracking-[-0.31px] font-normal font-['Inter',sans-serif] text-[#99A1AF]">
                {concept.description}
              </p>
              <ul className="mt-4 space-y-3 text-[14px] leading-[20px] tracking-[-0.15px] font-normal font-['Inter',sans-serif] text-[#D1D5DC]">
                {concept.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#0FF0FC]" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
