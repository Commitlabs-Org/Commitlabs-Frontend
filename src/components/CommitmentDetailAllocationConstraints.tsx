'use client';

import React from 'react';

interface Constraint {
  id: string;
  text: string;
}

interface CommitmentDetailAllocationConstraintsProps {
  constraints: Constraint[];
}

export default function CommitmentDetailAllocationConstraints({
  constraints,
}: CommitmentDetailAllocationConstraintsProps) {
  return (
    <section aria-label="Allocation constraints">
      <h2 className="text-white text-xl font-bold mb-4">Allocation Constraints</h2>
      <ul className="space-y-2">
        {constraints.map((c) => (
          <li
            key={c.id}
            className="flex items-start gap-3 bg-[#0a0a0a] rounded-xl p-4 border border-[#222]"
          >
            <span className="text-[#0FF0FC] mt-0.5" aria-hidden="true">
              ●
            </span>
            <span className="text-white/80 text-sm">{c.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
