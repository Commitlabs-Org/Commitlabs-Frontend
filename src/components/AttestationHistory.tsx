import React from "react";

export type AttestationSeverity = "low" | "medium" | "high" | "critical";

export interface AttestationItem {
  id: string;
  timestamp: string;
  status: string;
  severity?: AttestationSeverity;
  attestationType?: string;
  details?: string;
}

export interface AttestationHistoryProps {
  commitmentId: string;
  items?: AttestationItem[];
}

export default function AttestationHistory({
  commitmentId,
  items = [],
}: AttestationHistoryProps) {
  // Build the array items using conditional spreads to omit optional properties
  // instead of passing explicit undefined, satisfying exactOptionalPropertyTypes: true
  const formattedAttestations = items.map((item) => {
    return {
      id: item.id,
      timestamp: item.timestamp,
      status: item.status,
      ...(item.severity !== undefined ? { severity: item.severity } : {}),
      ...(item.attestationType !== undefined ? { attestationType: item.attestationType } : {}),
      ...(item.details !== undefined ? { details: item.details } : {}),
    };
  });

  return (
    <div className="attestation-history space-y-4">
      <h3 className="text-lg font-semibold">
        Attestation History for Commitment: {commitmentId}
      </h3>
      {formattedAttestations.length === 0 ? (
        <p className="text-sm text-gray-500">No attestations found.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {formattedAttestations.map((att) => (
            <li key={att.id} className="py-2 flex justify-between items-center">
              <div>
                <span className="font-medium">{att.id}</span>
                {att.attestationType && (
                  <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">
                    {att.attestationType}
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                {att.severity && (
                  <span className="mr-3 font-semibold uppercase text-xs">
                    {att.severity}
                  </span>
                )}
                <span>{att.status}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
