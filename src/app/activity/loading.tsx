import { Skeleton } from '@/components/Skeleton';

export default function ActivityLoading() {
  return (
    <section className="container pad-y" aria-busy="true" aria-label="Loading activity feed">
      <div className="between row mb">
        <div>
          <Skeleton width="240px" height="36px" style={{ marginBottom: '8px' }} />
          <Skeleton width="380px" height="20px" />
        </div>
        <div className="row gap">
          <Skeleton width="120px" height="36px" borderRadius="8px" />
          <Skeleton width="90px" height="36px" borderRadius="8px" />
        </div>
      </div>

      <div className="card row between mb filter-bar">
        <div className="row gap">
          <Skeleton width="180px" height="32px" borderRadius="6px" />
          <Skeleton width="140px" height="32px" borderRadius="6px" />
        </div>
      </div>

      <div className="card stack">
        <div className="table-responsive">
          <table className="table full-width">
            <thead>
              <tr>
                <th>Event</th>
                <th>Commitment</th>
                <th>Owner</th>
                <th>Amount</th>
                <th>Ledger</th>
                <th>Time</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  <td>
                    <Skeleton width="70px" height="24px" borderRadius="6px" />
                  </td>
                  <td>
                    <Skeleton width="50px" height="20px" />
                  </td>
                  <td>
                    <Skeleton width="110px" height="20px" />
                  </td>
                  <td>
                    <Skeleton width="80px" height="20px" />
                  </td>
                  <td>
                    <Skeleton width="60px" height="20px" />
                  </td>
                  <td>
                    <Skeleton width="70px" height="20px" />
                  </td>
                  <td>
                    <Skeleton width="60px" height="20px" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
