"use client";

import React from "react";
import { StarField } from "../ui/StarField";
import { FaGithub, FaEnvelope } from "react-icons/fa";
import { IoDocumentText } from "react-icons/io5";
import { motion, Variants } from "framer-motion";

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

export const HeroSection: React.FC = () => {
  return (
    <div className="min-h-screen w-full pb-10 bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
      <div className="relative w-full aspect-[1680/823.333]">
        {/* Stars */}
        <StarField />

        {/* Content */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center px-4 sm:px-8 lg:px-0"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="relative w-fit flex flex-col items-center">
            <div id="features" className="scroll-mt-28" aria-hidden="true" />
            {/* Logo & Title */}
            <motion.div
              variants={itemVariants}
              className="flex items-center justify-center gap-3 sm:gap-4 mb-8"
            >
              <div className="relative w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center pt-1">
                <div className="absolute inset-0 bg-[rgba(10,10,10,0.1)] rounded-full p-[0.556px] shadow-[0px_0px_20px_0px_#0ff0fc]">
                  <div className="absolute inset-0 border-[#0ff0fc] border-[0.556px] rounded-full" />
                </div>
                <div className="absolute inset-0 rounded-full shadow-[inset_0px_0px_15px_0px_rgba(245,245,247,0.3)]" />
                <p className="relative font-roboto font-normal text-white text-lg sm:text-xl lg:text-2xl leading-8 text-center z-10">
                  C
                </p>
              </div>
              <div className="flex items-center pt-2">
                <h1 className="font-roboto font-medium text-[#f5f5f7] text-xl sm:text-3xl lg:text-[30px] leading-9">
                  CommitLabs
                </h1>
              </div>
            </motion.div>

            {/* Hero Heading */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col items-center mb-6"
            >
              <h2 className="font-['Inter',sans-serif] font-bold text-4xl sm:text-5xl xl:text-[85px] leading-tight text-center bg-clip-text text-transparent bg-linear-to-b from-white to-[#99a1af]">
                Liquidity as a
              </h2>
              <h2 className="font-['Inter',sans-serif] font-bold text-4xl sm:text-5xl xl:text-[85px] leading-tight text-center bg-clip-text text-transparent bg-linear-to-b from-[#0ff0fc] to-[#0a7a82]">
                commitment,
              </h2>
              <h2 className="font-['Inter',sans-serif] font-bold text-4xl sm:text-5xl xl:text-[85px] leading-tight text-center bg-clip-text text-transparent bg-linear-to-b from-white to-[#99a1af]">
                not a guess.
              </h2>
            </motion.div>

            {/* Description */}
            <div id="how-it-works" className="scroll-mt-28" aria-hidden="true" />
            <motion.p
              variants={itemVariants}
              className="font-['Inter',sans-serif] font-normal text-[#99a1af] text-base sm:text-lg lg:text-2xl leading-relaxed lg:leading-9.75 text-center max-w-176.25 mb-2 tracking-[0.0703px] px-4"
            >
              Building core DeFi infrastructure that transforms passive
              liquidity into enforceable, attestable, and composable on-chain
              commitments.
            </motion.p>

            {/* CTA Button */}
            <div id="benefits" className="scroll-mt-28" aria-hidden="true" />
            <motion.div variants={itemVariants} className="relative">
              <div className="absolute inset-0 bg-linear-to-b from-[#0ff0fc] to-[#0a7a82] blur-lg opacity-50 rounded-[14px]" />
              <button className="relative hover:cursor-pointer group bg-[#0a0a0a] border-[0.556px] border-[rgba(15,240,252,0.3)] rounded-[14px] shadow-[0px_0px_30px_0px_rgba(15,240,252,0.2)] px-6 sm:px-8 py-3 sm:py-4 flex items-center gap-3 hover:shadow-[0px_0px_40px_0px_rgba(15,240,252,0.4)] transition-shadow">
                <span className="font-['Roboto_Mono',sans-serif] font-medium text-base sm:text-lg bg-clip-text text-transparent bg-linear-to-b from-[#f5f5f7] to-[#909091]">
                  Explore the Protocol
                </span>
                <svg
                  className="w-5 h-5 shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-1.5"
                  fill="none"
                  viewBox="0 0 20 20"
                >
                  <path
                    d="M4.16667 10H15.8333"
                    stroke="#0FF0FC"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.66667"
                  />
                  <path
                    d="M10 4.16667L15.8333 10L10 15.8333"
                    stroke="#0FF0FC"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.66667"
                  />
                </svg>
              </button>
            </motion.div>

            {/* Social Icons */}
            <motion.div
              variants={itemVariants}
              className="flex gap-8 items-center justify-center mt-10"
            >
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80"
              >
                <FaGithub className="text-[#0a7a82] animate-bounce" size={30} />
              </a>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80"
              >
                <FaEnvelope
                  className="text-[#0a7a82] animate-bounce"
                  size={30}
                />
              </a>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80"
              >
                <IoDocumentText
                  className="text-[#0a7a82] animate-bounce"
                  size={30}
                />
              </a>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
