'use client';

import React from 'react';
import { useNetwork } from './NetworkProvider';

/**
 * Explains the consequences of the selected network: mainnet uses real funds,
 * and a network without a deployment is read-only.
 */
export function NetworkNotice() {
  const { network, config, isContractConfigured } = useNetwork();

  if (network === 'mainnet') {
    return (
      <div className="notice" role="status" data-testid="mainnet-warning">
        You are on Stellar mainnet. Transactions use real funds and cannot be undone.
        {!isContractConfigured && ' No escrow contract is deployed here, so write actions are disabled.'}
      </div>
    );
  }

  if (!isContractConfigured) {
    return (
      <div className="notice" role="status" data-testid="no-contract-notice">
        No escrow contract is deployed on {config.networkDetails.label}. On-chain write actions are
        disabled; existing commitments stay in local demo mode.
      </div>
    );
  }

  return null;
}
