import { Skeleton } from '@/components/Skeleton';

export default function CreateLoading() {
  return (
    <section className="container page narrow" aria-busy="true" aria-label="Loading create form">
      <Skeleton width="280px" height="42px" style={{ marginBottom: '20px' }} />

      <div className="row" style={{ gap: '8px', marginBottom: '24px' }}>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} width="90px" height="32px" borderRadius="999px" />
        ))}
      </div>

      <div className="stack">
        <div className="grid3">
          {[0, 1, 2].map((i) => (
            <div className="card pick" key={i} style={{ minHeight: '130px' }}>
              <Skeleton width="100px" height="24px" style={{ marginBottom: '10px' }} />
              <Skeleton width="100%" height="16px" style={{ marginBottom: '8px' }} />
              <Skeleton width="60%" height="16px" style={{ marginBottom: '16px' }} />
              <Skeleton width="70px" height="20px" />
            </div>
          ))}
        </div>

        <div className="row end">
          <Skeleton width="110px" height="42px" borderRadius="10px" />
        </div>
      </div>
    </section>
  );
}
