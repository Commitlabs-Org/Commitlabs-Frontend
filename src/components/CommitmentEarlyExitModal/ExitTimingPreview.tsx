import React, { useState, useEffect, useMemo } from 'react';

interface ExitTimingPreviewProps {
  commitmentId: string;
  originalAmount: number;
  currentPenaltyPercent: number;
  maturityDate: Date;
}

interface PreviewResult {
  penaltyAmount: number;
  netRefund: number;
}

export function ExitTimingPreview({
  commitmentId,
  originalAmount,
  currentPenaltyPercent,
  maturityDate,
}: ExitTimingPreviewProps) {
  const [daysFromNow, setDaysFromNow] = useState(0);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Base current penalty to interpolate from (fetched once or passed as prop).
  // The API doesn't take a future date, so we request once and interpolate.
  const [basePenaltyAmount, setBasePenaltyAmount] = useState<number | null>(null);

  const totalDays = useMemo(() => {
    const now = new Date();
    const diffTime = maturityDate.getTime() - now.getTime();
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }, [maturityDate]);

  // Fetch the baseline penalty from the API when component mounts
  useEffect(() => {
    let isMounted = true;
    const fetchBasePreview = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/commitments/${encodeURIComponent(commitmentId)}/early-exit/preview`);
        if (!res.ok) {
          throw new Error('Failed to fetch preview');
        }
        const data = await res.json();
        if (isMounted) {
          setBasePenaltyAmount(data.data?.penaltyAmount ?? (originalAmount * currentPenaltyPercent / 100));
        }
      } catch (err) {
        if (isMounted) {
          // Fallback to calculation if API fails
          setBasePenaltyAmount(originalAmount * currentPenaltyPercent / 100);
          setError('Failed to fetch live preview. Using estimates.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchBasePreview();
    return () => { isMounted = false; };
  }, [commitmentId, originalAmount, currentPenaltyPercent]);

  // Calculate the projected preview whenever slider changes
  useEffect(() => {
    if (basePenaltyAmount === null) return;
    
    // Linearly interpolate the penalty down to 0 at maturity
    const remainingDays = Math.max(0, totalDays - daysFromNow);
    const interpolatedPenalty = basePenaltyAmount * (remainingDays / totalDays);
    const netRefund = originalAmount - interpolatedPenalty;
    
    // Simulate debounced API call feel for UI responsiveness
    const timeout = setTimeout(() => {
      setPreview({
        penaltyAmount: interpolatedPenalty,
        netRefund: netRefund,
      });
    }, 300);
    
    return () => clearTimeout(timeout);
  }, [daysFromNow, basePenaltyAmount, totalDays, originalAmount]);

  const projectedDate = new Date();
  projectedDate.setDate(projectedDate.getDate() + daysFromNow);

  return (
    <div className="bg-[#050505] border border-white/10 rounded-2xl p-5 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[14px] font-bold text-white uppercase tracking-widest">
          Exit Timing Preview
        </h3>
        {error && <span className="text-[12px] text-[#FF8A04]">{error}</span>}
      </div>
      
      <div className="mb-6">
        <div className="flex justify-between text-[12px] text-white/50 mb-2">
          <span>Now</span>
          <span>{totalDays} Days (Maturity)</span>
        </div>
        
        <input
          type="range"
          min={0}
          max={totalDays}
          value={daysFromNow}
          onChange={(e) => setDaysFromNow(parseInt(e.target.value, 10))}
          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#0FF0FC]"
          aria-label={`Exit timing slider. Selected: ${daysFromNow} days from now, Date: ${projectedDate.toLocaleDateString()}`}
        />
        
        <div className="text-center mt-3 text-[13px] text-white/80 font-medium">
          Projected Exit Date: <span className="text-white">{projectedDate.toLocaleDateString()}</span>
        </div>
      </div>

      <div className="bg-white/[0.02] rounded-xl p-4 flex justify-between items-center border border-white/[0.05]">
        <div>
          <div className="text-[12px] text-[#FF8A04]/80 mb-1">Projected Penalty</div>
          <div className="text-[16px] text-[#FF8A04] font-bold">
            {loading || !preview ? '---' : `-${preview.penaltyAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12px] text-white/50 mb-1">Net Refund</div>
          <div className="text-[18px] text-[#0FF0FC] font-extrabold">
            {loading || !preview ? '---' : preview.netRefund.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  );
}
