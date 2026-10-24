'use client';

import { TYPES } from '@/lib/commitments';
import { useProtocolParams } from '@/lib/protocol';
import { DISPLAY_APY } from '@/lib/yield';
import { Skeleton } from '@/components/Skeleton';

export function DocsTypesTable() {
  const { params, loading, isFallback } = useProtocolParams();

  return (
    <>
      {isFallback && (
        <p className="muted small" role="note" style={{ marginBottom: '0.5rem' }}>
          Could not verify on-chain parameters. Displaying default protocol parameters.
        </p>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Target APY</th>
              <th>Max loss</th>
              <th>Early exit penalty</th>
              <th>Min lock</th>
            </tr>
          </thead>
          <tbody>
            {TYPES.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{DISPLAY_APY[t.id]}%</td>
                <td>{t.maxLoss}%</td>
                <td>
                  {loading ? (
                    <Skeleton width="45px" height="18px" />
                  ) : (
                    `${params.penalties[t.id] / 100}%`
                  )}
                </td>
                <td>{t.minDays} days</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
