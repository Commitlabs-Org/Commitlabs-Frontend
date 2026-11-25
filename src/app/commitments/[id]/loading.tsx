import { Skeleton } from '@/components/Skeleton';

export default function CommitmentLoading() {
  return (
    <section className="container page" aria-busy="true" aria-label="Loading commitment details">
      <div className="row between wrap">
        <div>
          <Skeleton width="260px" height="36px" />
          <div style={{ marginTop: '8px' }}>
            <Skeleton width="180px" height="20px" />
          </div>
        </div>
        <Skeleton width="120px" height="32px" borderRadius="999px" />
      </div>

      <div className="grid3 mt">
        <div className="card">
          <Skeleton width="60%" height="24px" />
          <div style={{ marginTop: '16px' }}>
            <Skeleton width="100%" height="16px" />
            <div style={{ marginTop: '8px' }}>
              <Skeleton width="80%" height="16px" />
            </div>
          </div>
        </div>
        <div className="card">
          <Skeleton width="60%" height="24px" />
          <div style={{ marginTop: '16px' }}>
            <Skeleton width="100%" height="16px" />
            <div style={{ marginTop: '8px' }}>
              <Skeleton width="80%" height="16px" />
            </div>
          </div>
        </div>
        <div className="card">
          <Skeleton width="60%" height="24px" />
          <div style={{ marginTop: '16px' }}>
            <Skeleton width="100%" height="16px" />
            <div style={{ marginTop: '8px' }}>
              <Skeleton width="80%" height="16px" />
            </div>
          </div>
        </div>
      </div>

      <div className="card mt">
        <Skeleton width="200px" height="28px" />
        <div style={{ marginTop: '16px' }}>
          <Skeleton width="100%" height="60px" />
        </div>
      </div>
    </section>
  );
}
