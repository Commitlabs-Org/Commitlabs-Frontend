"use client";

import React from "react";
import { motion } from "framer-motion";
import { FaGithub, FaEnvelope } from "react-icons/fa";
import { IoDocumentText } from "react-icons/io5";

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

interface ActionCardProps {
  icon: React.ReactNode;
  label: string;
  href?: string;
}

const ActionCard: React.FC<ActionCardProps> = ({ icon, label, href = "#" }) => {
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      variants={cardVariants}
      whileHover={{ scale: 1.05, y: -5 }}
      whileTap={{ scale: 0.98 }}
      className="relative group bg-[rgba(10,10,10,0.6)] backdrop-blur-sm border border-[rgba(15,240,252,0.2)] rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center gap-4 hover:border-[rgba(15,240,252,0.5)] transition-all duration-300 min-w-[140px] sm:min-w-[180px]"
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-b from-[rgba(15,240,252,0.1)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />

      {/* Icon */}
      <div className="relative z-10 text-[#0ff0fc] transition-transform duration-300 group-hover:scale-110">
        {icon}
      </div>

      {/* Label */}
      <span className="relative z-10 font-['Roboto_Mono',sans-serif] font-medium text-sm sm:text-base text-[#f5f5f7] text-center">
        {label}
      </span>
    </motion.a>
  );
};

export const ExperienceSection: React.FC = () => {
  return (
    <section className="relative w-full py-20 sm:py-32 bg-[#0a0a0a] overflow-hidden">
      {/* Background gradient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#0dd5e4] opacity-20 blur-[150px] rounded-full" />

      <motion.div
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 flex flex-col items-center"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
      >
        {/* Heading */}
        <motion.div
          variants={itemVariants}
          className="text-center mb-8 sm:mb-12"
        >
          <h2 className="font-['Inter',sans-serif] font-bold text-4xl sm:text-5xl lg:text-6xl xl:text-7xl leading-tight mb-4">
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-[#99a1af]">
              Experience CommitLabs
            </span>
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-[#0ff0fc] to-[#0a7a82]">
              Today
            </span>
          </h2>

          <p className="font-['Inter',sans-serif] font-normal text-[#99a1af] text-base sm:text-lg lg:text-xl leading-relaxed max-w-2xl mx-auto mt-6">
            Join us in building the future of DeFi infrastructure. Transform
            passive capital into enforceable commitments.
          </p>
        </motion.div>

        {/* CTA Button */}
        <motion.div variants={itemVariants} className="relative mb-12 sm:mb-16">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0ff0fc] to-[#3e989e] blur-lg opacity-100 rounded-[14px]" />
          <button className="relative hover:cursor-pointer group bg-[#0a0a0a] border-[0.556px] border-[rgba(15,240,252,0.3)] rounded-[14px] shadow-[0px_0px_30px_0px_rgba(15,240,252,0.2)] px-8 sm:px-10 py-4 sm:py-5 flex items-center gap-3 hover:shadow-[0px_0px_40px_0px_rgba(15,240,252,0.4)] transition-all duration-300">
            <span className="font-['Roboto_Mono',sans-serif] font-medium text-base sm:text-lg bg-clip-text text-transparent bg-gradient-to-b from-[#f5f5f7] to-[#909091]">
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

        {/* Action Cards */}
        <motion.div
          variants={itemVariants}
          className="flex flex-wrap items-center justify-center gap-6 sm:gap-8"
        >
          <ActionCard
            icon={<FaGithub size={40} />}
            label="View on Github"
            href="https://github.com/muhsar27/Commitlabs-Frontend"
          />
          <ActionCard
            icon={<IoDocumentText size={40} />}
            label="Read Docs"
            href="/docs"
          />
          <ActionCard
            icon={<FaEnvelope size={40} />}
            label="Get in Touch"
            href="mailto:hello@commitlabs.com"
          />
        </motion.div>
      </motion.div>
    </section>
  );
};
