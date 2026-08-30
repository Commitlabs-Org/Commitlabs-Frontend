'use client';

export interface SettlementReceiptData {
  commitmentId: string;
  finalValue: string;
  fees: string;
  transactionHash: string;
  settledAt: string;
}

export function buildReceiptFilename(commitmentId: string, settledAt: string): string {
  const safeId = commitmentId.replace(/[^a-z0-9_-]/gi, '-').slice(0, 80) || 'commitment';
  const date = new Date(settledAt).toISOString().slice(0, 10);
  return `settlement-receipt-${safeId}-${date}`;
}

export function printSettlementReceipt(data: SettlementReceiptData): void {
  const previousTitle = document.title;
  document.title = buildReceiptFilename(data.commitmentId, data.settledAt);
  window.print();
  window.setTimeout(() => {
    document.title = previousTitle;
  }, 0);
}

export function SettlementReceipt({
  status,
  data,
}: {
  status: 'pending' | 'success';
  data: SettlementReceiptData;
}) {
  if (status !== 'success') return null;

  return (
    <section
      aria-label="Settlement receipt"
      className="rounded-xl border border-white/10 bg-white p-6 text-black"
    >
      <h2 className="text-xl font-semibold">Settlement receipt</h2>
      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <dt className="font-medium">Commitment</dt>
          <dd>{data.commitmentId}</dd>
        </div>
        <div>
          <dt className="font-medium">Final value</dt>
          <dd>{data.finalValue}</dd>
        </div>
        <div>
          <dt className="font-medium">Fees / penalty</dt>
          <dd>{data.fees}</dd>
        </div>
        <div>
          <dt className="font-medium">Transaction</dt>
          <dd className="break-all">{data.transactionHash}</dd>
        </div>
        <div>
          <dt className="font-medium">Settled</dt>
          <dd>{data.settledAt}</dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={() => printSettlementReceipt(data)}
        className="mt-5 rounded-lg bg-black px-4 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        Download receipt
      </button>
    </section>
  );
}
