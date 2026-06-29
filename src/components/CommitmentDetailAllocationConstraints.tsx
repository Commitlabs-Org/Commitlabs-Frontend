import React from "react";
import { Info } from "lucide-react";
import GlossaryTerm from "./GlossaryTerm";

interface Constraint {
  id: string;
  text: string;
}

interface CommitmentDetailAllocationConstraintsProps {
  constraints: Constraint[];
  noteText?: string;
}

export default function CommitmentDetailAllocationConstraints({
  constraints,
  noteText = "On-chain enforcement: Constraints are enforced by smart contracts and cannot be changed after commitment creation. Violations are automatically detected and recorded as attestations.",
}: CommitmentDetailAllocationConstraintsProps) {
  return (
    <section className="space-y-4 w-full">
      <h2 className="text-lg font-bold text-white">Allocation Constraints</h2>

      <ul className="flex flex-col gap-3 p-0 m-0 list-none">
        {constraints.map((constraint) => (
          <li
            key={constraint.id}
            className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#0f0f10] px-5 py-4 transition-all duration-200 hover:bg-[#1a1a1c] hover:border-white/[0.12]"
          >
            <div className="h-2 w-2 shrink-0 rounded-full bg-[#0ff0fc] shadow-[0_0_8px_rgba(15,240,252,0.5)]" />
            <span className="text-[15px] text-[#e0e0e0] font-medium">
              {constraint.text}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-xl border border-white/[0.08] bg-[#0A0A0B] p-5 relative overflow-hidden">
        {/* Subtle cyan glow at the bottom/left */}
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#0ff0fc]/[0.03] blur-2xl rounded-full pointer-events-none" />

        <div className="relative flex gap-3 z-10 items-start">
          <Info className="h-5 w-5 text-[#0ff0fc] flex-shrink-0 mt-0.5 opacity-80" />
          <p className="text-sm text-[#99a1af] leading-relaxed">
            <strong className="text-[#0ff0fc] font-semibold opacity-90 mr-1">
              On-chain enforcement:
            </strong>
            {noteText.replace(/^On-chain enforcement:\s*/i, "").split(/(attestations?)/i).map((part, i) => 
              /attestations?/i.test(part) ? <GlossaryTerm key={i} termKey="attestation">{part}</GlossaryTerm> : part
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
