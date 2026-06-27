import React from "react";
import { Commitment } from "@/types/commitment";
import Link from "next/link";
import {
  SafeIcon,
  BalancedIcon,
  AggressiveIcon,
  EyeIcon,
  FileTextIcon,
  AlertIcon,
} from "./icons/CommitmentIcons";
import { TrendingUp as Increase, TrendingDown as Decrease, Tag } from "lucide-react";

interface MyCommitmentCardProps {
  commitment: Commitment;
  onDetails?: (id: string) => void;
  onAttestations?: (id: string) => void;
  onEarlyExit?: (id: string) => void;
  onListForSale?: (id: string) => void;
}

const MyCommitmentCard: React.FC<MyCommitmentCardProps> = ({
  commitment,
  onDetails,
  onAttestations,
  onEarlyExit,
  onListForSale,
}) => {
  const {
    id,
    type,
    status,
    asset,
    amount,
    currentValue,
    changePercent,
    durationProgress,
    daysRemaining,
    complianceScore,
    maxLoss,
    currentDrawdown,
    createdDate,
    expiryDate,
  } = commitment;

  const TypeIcon =
    type === "Safe"
      ? SafeIcon
      : type === "Balanced"
      ? BalancedIcon
      : AggressiveIcon;
  const typeBadgeClass =
    type === "Safe"
      ? "border border-[rgba(16,185,129,0.5)] text-[#05DF72] font-roboto"
      : type === "Balanced"
      ? "border border-[rgba(59,130,246,0.5)] text-[#51a2ff] font-roboto"
      : "border border-[rgba(245,158,11,0.5)] text-[#ff8904] font-roboto";
  const statusBadgeClass =
    status === "Active"
      ? "bg-[rgba(16,185,129,0.1)] text-[#05DF72] font-roboto"
      : status === "Settled"
      ? "bg-[rgba(59,130,246,0.1)] text-[#51a2ff] font-roboto"
      : status === "Early Exit"
      ? "bg-[rgba(245,158,11,0.1)] text-[#ff8904] font-roboto"
      : "bg-[rgba(239,68,68,0.1)] text-[#ef4444] font-roboto";
  const isPositive = changePercent >= 0;

  // Dynamic colors
  const durationColorClass =
    "bg-[linear-gradient(180deg,#0FF0FC_0%,#0A7A82_100%)]";

  const complianceColorClass =
    complianceScore > 80
      ? "bg-[#05DF72]"
      : "bg-[linear-gradient(180deg,#0FF0FC_0%,#0A7A82_100%)]";

  return (
    <div className="relative flex flex-col gap-5 rounded-[16px] border border-white/10 bg-[rgba(13,13,13,0.8)] p-6 text-white backdrop-blur-[10px] overflow-hidden transition-[transform,border-color] duration-200 ease-[ease] hover:border-[rgba(15,240,252,0.3)]">
      <div className="flex items-center justify-between">
        <div
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold ${typeBadgeClass}`}
        >
          <TypeIcon size={14} />
          <span>{type}</span>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-[12px] font-semibold ${statusBadgeClass}`}
        >
          {status}
        </div>
      </div>

      <div className="mt-1">
        <Link
          href={`/commitments/${id}`}
          className="font-mono text-[12px] text-[#0FF0FC] opacity-80"
        >
          {id}
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2 text-[32px] font-bold font-roboto">
          {amount}{" "}
          <span
            className="text-[16px] font-medium text-[#666]"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {asset}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[14px]">
          <span className="text-[#94A3B8]">Current Value:</span>
          <span style={{ fontWeight: 600, fontFamily: "Roboto Mono" }}>
            {currentValue} {asset}
          </span>
          <span
            className={isPositive ? "text-[#05DF72]" : "text-[#EF4444]"}
            style={{ fontWeight: 600, fontFamily: "'Roboto Mono', sans-serif" }}
          >
            {isPositive ? (
              <Increase
                size={12}
                style={{ display: "inline", marginRight: 4 }}
              />
            ) : (
              <Decrease
                size={12}
                style={{ display: "inline", marginRight: 4 }}
              />
            )}
            {isPositive ? "+" : ""}
            {changePercent.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[12px]">
            <span
              className="text-[#94A3B8] font-normal font-['Inter', sans-serif]"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "12px",
                letterSpacing: "0.05em",
              }}
            >
              Duration Progress
            </span>
            <span className="text-white font-medium font-roboto">
              {daysRemaining} days left
            </span>
          </div>
          <div className="h-[6px] rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full ${durationColorClass}`}
              style={{ width: `${durationProgress}%` }}
            />
          </div>
          <span
            className="text-[#94A3B8] font-roboto"
            style={{ fontSize: "12px", marginTop: "-4px" }}
          >
            {durationProgress}%
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[12px]">
            <span
              className="text-[#94A3B8]"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "12px",
                letterSpacing: "0.05em",
              }}
            >
              Compliance Score
            </span>
            <span className="text-white font-semibold">{complianceScore}%</span>
          </div>
          <div className="h-[6px] rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full ${complianceColorClass}`}
              style={{ width: `${complianceScore}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex h-full w-full flex-col gap-[3.99px] rounded-[10px] bg-[#FFFFFF05] px-3 py-3">
          <span
            className="text-[12px] tracking-[0.05em] text-[#94A3B8]"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Max Loss
          </span>
          <span className="text-[16px] font-semibold font-roboto">
            {maxLoss}
          </span>
        </div>
        <div className="flex h-full w-full flex-col gap-[3.99px] rounded-[10px] bg-[#FFFFFF05] px-3 py-3">
          <span
            className="text-[12px] tracking-[0.05em] text-[#94A3B8]"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Current Drawdown
          </span>
          <span className="text-[16px] font-semibold font-roboto">
            {currentDrawdown}
          </span>
        </div>
      </div>

      <div className="flex justify-between text-[12px]">
        <div className="flex flex-col gap-1">
          <span
            className="text-[12px] tracking-[0.05em] text-[#94A3B8]"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Created
          </span>
          <span className="text-white font-roboto">{createdDate}</span>
        </div>
        <div className="flex flex-col gap-1 items-end">
          <span
            className="text-[12px] tracking-[0.05em] text-[#94A3B8]"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            Expires
          </span>
          <span className="text-white font-roboto">{expiryDate}</span>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3">
          <button
            className="flex items-center justify-center gap-2 rounded-[8px] border border-[rgba(15,240,252,0.2)] bg-[rgba(15,240,252,0.05)] px-2.5 py-2 text-[14px] font-semibold text-[#0FF0FC] transition-all duration-200 ease-[ease] hover:bg-[rgba(15,240,252,0.1)]"
            onClick={() => onDetails?.(id)}
          >
            <EyeIcon size={16} /> Details
          </button>
          <button
            className="flex items-center justify-center gap-2 rounded-[10px] border-[0.56px] border-t-[0.56px] border-t-[#FFFFFF1A] border-[#FFFFFF1A] bg-[#FFFFFF0D] px-2.5 py-2 text-[14px] font-semibold text-white transition-all duration-200 ease-[ease] hover:bg-[#FFFFFF1A]"
            onClick={() => onAttestations?.(id)}
          >
            <FileTextIcon size={16} /> Attestations
          </button>
        </div>
        {status === "Active" && (
          <button
            className="flex w-full items-center justify-center gap-2 rounded-[8px] border border-[rgba(15,240,252,0.2)] bg-[rgba(15,240,252,0.05)] px-2.5 py-2 text-[14px] font-semibold text-[#0FF0FC] transition-all duration-200 ease-[ease] hover:bg-[rgba(15,240,252,0.1)]"
            onClick={() => onListForSale?.(id)}
            aria-label={`List ${id} for sale on the marketplace`}
          >
            <Tag size={16} /> List for sale
          </button>
        )}
        {status === "Active" && (
          <button
            className="flex w-full items-center justify-center gap-2 rounded-[8px] border border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.05)] px-2.5 py-2 text-[14px] font-semibold text-[#ff8904] transition-all duration-200 ease-[ease] hover:bg-[rgba(245,158,11,0.1)]"
            onClick={() => onEarlyExit?.(id)}
          >
            <AlertIcon size={16} /> Early Exit (Penalty Applies)
          </button>
        )}
      </div>
    </div>
  );
};

// Memoized so that filtering/sorting a large list only re-renders cards whose
// props actually changed. `commitment` keeps a stable reference across filter/
// sort operations, and the callbacks are stabilized with useCallback by the
// parent, so React.memo's shallow prop comparison skips unchanged cards.
export default React.memo(MyCommitmentCard);
