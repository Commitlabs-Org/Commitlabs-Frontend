import { Skeleton } from '@/components/Skeleton';

export default function DashboardLoading() {
  return (
    <section className="container page" aria-busy="true" aria-label="Loading dashboard">
      <div className="row between wrap">
        <Skeleton width="180px" height="42px" borderRadius="8px" />
        <Skeleton width="150px" height="38px" borderRadius="10px" />
      </div>

      <div className="grid4">
        {[0, 1, 2, 3].map((i) => (
          <div className="card metric" key={i}>
            <Skeleton width="120px" height="18px" style={{ marginBottom: '8px' }} />
            <Skeleton width="90px" height="32px" />
          </div>
        ))}
      </div>

      <h2 className="mt">
        <Skeleton width="200px" height="28px" />
      </h2>

      <div className="stack">
        {[0, 1, 2].map((i) => (
          <article className="card commit" key={i}>
            <div className="row between wrap">
              <div>
                <Skeleton width="220px" height="24px" style={{ marginBottom: '8px' }} />
                <Skeleton width="320px" height="16px" />
              </div>
              <Skeleton width="90px" height="34px" borderRadius="10px" />
            </div>
            <div className="bar" style={{ marginTop: '14px', marginBottom: '8px' }}>
              <div style={{ width: '40%', opacity: 0.5 }} />
            </div>
            <Skeleton width="180px" height="14px" />
          </article>
        ))}
      </div>
    </section>
  );
}
