import React from 'react';

interface PrintPageProps {
  params: { id: string };
}

export const metadata = {
  title: 'Commitment Detail — Print View',
  robots: 'noindex',
};

// Lightweight print-friendly view — uses window.print() via inline script
export default function CommitmentPrintPage({ params }: PrintPageProps) {
  const { id } = params;

  return (
    <html>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body { margin: 0; font-family: sans-serif; }
            .no-print { display: none !important; }
          }
          body { font-family: sans-serif; color: #111; background: #fff; padding: 2rem; }
          h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
          .meta { color: #555; font-size: 0.85rem; margin-bottom: 1.5rem; }
          table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
          th, td { border: 1px solid #ddd; padding: 0.5rem 0.75rem; text-align: left; }
          th { background: #f5f5f5; font-weight: 600; }
          .section { margin-top: 2rem; }
          .section h2 { font-size: 1.1rem; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; }
          .print-btn { margin-bottom: 1.5rem; padding: 0.5rem 1.25rem; cursor: pointer; }
        ` }} />
      </head>
      <body>
        <button
          className="print-btn no-print"
          onClick={() => window?.print()}
          type="button"
        >
          Print / Save PDF
        </button>

        <h1>Commitment #{id} — Detail Report</h1>
        <p className="meta">
          Printed at: {new Date().toLocaleString()} &nbsp;|&nbsp; Commitment ID: {id}
        </p>

        <div className="section">
          <h2>Summary</h2>
          <table>
            <tbody>
              <tr><th>Commitment ID</th><td>{id}</td></tr>
              <tr><th>Type</th><td>Balanced</td></tr>
              <tr><th>Duration</th><td>60 days</td></tr>
              <tr><th>Max Loss Threshold</th><td>8%</td></tr>
              <tr><th>Status</th><td>Active</td></tr>
            </tbody>
          </table>
        </div>

        <div className="section">
          <h2>Value History</h2>
          <table>
            <thead>
              <tr><th>Date</th><th>Current Value</th><th>Initial Amount</th></tr>
            </thead>
            <tbody>
              <tr><td>Jan 10</td><td>$50,000</td><td>$50,000</td></tr>
              <tr><td>Jan 15</td><td>$52,000</td><td>$50,000</td></tr>
              <tr><td>Jan 20</td><td>$51,500</td><td>$50,000</td></tr>
              <tr><td>Jan 25</td><td>$53,000</td><td>$50,000</td></tr>
              <tr><td>Jan 28</td><td>$54,000</td><td>$50,000</td></tr>
            </tbody>
          </table>
        </div>

        <div className="section">
          <h2>Compliance</h2>
          <table>
            <thead>
              <tr><th>Date</th><th>Compliance Score</th></tr>
            </thead>
            <tbody>
              <tr><td>Jan 1</td><td>98%</td></tr>
              <tr><td>Jan 15</td><td>95%</td></tr>
              <tr><td>Jan 30</td><td>99%</td></tr>
            </tbody>
          </table>
        </div>

        <p className="no-print" style={{ marginTop: '2rem', color: '#555', fontSize: '0.8rem' }}>
          Navigate back to{' '}
          <a href={`/commitments/${id}`}>Commitment Detail</a>
        </p>
      </body>
    </html>
  );
}
