import React from 'react';
import { toTxError, transactionExplorerUrl } from '../lib/soroban/errors';

export interface TxErrorNoticeProps {
  error: unknown;
}

export function TxErrorNotice({ error }: TxErrorNoticeProps) {
  const txError = toTxError(error);
  const explorerUrl = transactionExplorerUrl(txError);

  return (
    <div className="notice" role="alert">
      <p>{txError.message}</p>
      {txError.hint && <p>{txError.hint}</p>}
      {explorerUrl && (
        <p>
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
            View transaction on stellar.expert
          </a>
        </p>
      )}
      {txError.details && (
        <details>
          <summary>Show technical details</summary>
          <pre>{txError.details}</pre>
        </details>
      )}
    </div>
  );
}
