"use client";

import React from "react";
import { StarField } from "../ui/StarField";
import { FaGithub, FaEnvelope } from "react-icons/fa";
import { IoDocumentText } from "react-icons/io5";
import { motion, Variants } from "framer-motion";
import Link from "next/link";

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
              <div className="flex flex-col sm:flex-row gap-4 mt-6">
                <Link href="/create" className="bg-[#0ff0fc] text-black font-medium py-3 px-6 rounded-md hover:bg-[#0a7a82] transition-colors">
                  Create commitment
                </Link>
                <Link href="/marketplace" className="bg-[#0a0a0a] border border-[#0ff0fc] text-[#0ff0fc] font-medium py-3 px-6 rounded-md hover:bg-[#0ff0fc] hover:text-black transition-colors">
                  Explore marketplace
                </Link>
              </div>
            </motion.div>

            {/* Social Icons */}
            <motion.div
              variants={itemVariants}
              className="flex gap-8 items-center justify-center mt-10"
            >
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80"
                aria-label="Visit GitHub"
              >
                <FaGithub className="text-[#0a7a82] animate-bounce" size={30} />
              </a>
              <a
                href="mailto:hello@commitlabs.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80"
                aria-label="Email CommitLabs"
              >
                <FaEnvelope
                  className="text-[#0a7a82] animate-bounce"
                  size={30}
                />
              </a>
              <a
                href="/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80"
                aria-label="Read documentation"
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