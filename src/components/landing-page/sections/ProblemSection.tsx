 "use client";
 
 import React from "react";
 import { motion, Variants } from "framer-motion";
import { FiActivity } from "react-icons/fi";
import { FaDollarSign } from "react-icons/fa";
import { HiOutlineExclamationCircle } from "react-icons/hi";
import { TbBolt, TbShieldOff, TbLinkOff } from "react-icons/tb";

type ProblemItem = {
  title: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const problems: ProblemItem[] = [
  {
    title: "Volatile & Unpredictable",
    description:
      "Liquidity is highly volatile with no guarantees on duration or behavior",
    Icon: FiActivity,
  },
  {
    title: "Emission Dependency",
    description:
      "Protocols rely on inflationary emissions just to retain capital",
    Icon: FaDollarSign,
  },
  {
    title: "No Reliability Metrics",
    description: "There is no way to measure or price liquidity reliability",
    Icon: HiOutlineExclamationCircle,
  },
  {
    title: "Cascading Failures",
    description: "Sudden liquidity exits cause devastating cascading failures",
    Icon: TbBolt,
  },
  {
    title: "Zero Guarantees",
    description: "LP tokens provide no guarantees about commitment duration",
    Icon: TbShieldOff,
  },
  {
    title: "Temporary Capital",
    description:
      "Liquidity is treated as temporary capital, not infrastructure",
    Icon: TbLinkOff,
  },
];

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};
 
 export const ProblemSection: React.FC = () => {
   return (
     <section
       aria-labelledby="problem-heading"
       className="w-full bg-[#0a0a0a] py-24 px-4 sm:px-8 flex justify-center"
     >
       <motion.div
         className="w-full max-w-7xl"
         variants={containerVariants}
         initial="hidden"
         whileInView="visible"
         viewport={{ once: true, amount: 0.2 }}
       >
         <motion.div
           className="flex flex-col items-center text-center gap-5 mb-12"
           variants={itemVariants}
         >
           <div className="relative inline-flex items-center">
             <span className="relative z-10 px-3 py-1 rounded-full text-xs tracking-wide uppercase text-[#0ff0fc] border border-[rgba(15,240,252,0.3)]">
               THE PROBLEM
             </span>
           </div>
 
           <h2
             id="problem-heading"
             className="font-['Inter',sans-serif] font-bold text-3xl sm:text-4xl xl:text-[64px] leading-tight bg-clip-text text-transparent bg-linear-to-b from-white to-[#99a1af]"
           >
             Always standing between you and predictable liquidity.
           </h2>
 
           <p className="font-['Inter',sans-serif] text-[#99a1af] text-base sm:text-lg lg:text-xl max-w-3xl">
             In today's DeFi ecosystem, liquidity volatility creates systemic risk
             and unpredictability that undermines protocol sustainability.
           </p>
         </motion.div>
 
         <ul
           role="list"
           className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
         >
           {problems.map(({ title, description, Icon }, idx) => (
             <motion.li
               key={idx}
               variants={cardVariants}
               className="group rounded-2xl border border-white/10 bg-white/3 p-6 lg:p-8 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_0_30px_rgba(15,240,252,0.20)]"
             >
               <div className="flex items-start gap-4">
                 <div className="shrink-0 w-11 h-11 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center">
                   <Icon
                     className="w-6 h-6 text-[#0ff0fc]"
                     aria-hidden="true"
                   />
                 </div>
                 <div className="flex flex-col">
                   <h3 className="text-white font-semibold text-lg">
                     {title}
                   </h3>
                   <p className="text-[#99a1af] text-sm mt-2">
                     {description}
                   </p>
                 </div>
               </div>
             </motion.li>
           ))}
         </ul>
       </motion.div>
     </section>
   );
 };
 
 export default ProblemSection;
