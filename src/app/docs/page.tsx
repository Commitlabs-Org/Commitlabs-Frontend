import Link from 'next/link';
import { DocsTypesTable } from './DocsTypesTable';
import { ESCROW_CONTRACT_ID, NETWORK, REPO_URL, explorerContractUrl, config } from '@/lib/config';

export const metadata = { title: 'Docs - CommitLabs' };

const TOC = [
  ['overview', 'Overview'],
  ['concepts', 'Core concepts'],
  ['lifecycle', 'Commitment lifecycle'],
  ['types', 'Commitment types'],
  ['contracts', 'Contracts'],
  ['setup', 'Run locally'],
  ['env', 'Environment variables'],
  ['faq', 'FAQ'],
];

export default function DocsPage() {
  return (
    <section className="container page docs">
      <aside className="toc" aria-label="Table of contents">
        <b>Documentation</b>
        {TOC.map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </aside>

      <div className="doc-body">
        <h1>Documentation</h1>

        <h2 id="overview">Overview</h2>
        <p>
          CommitLabs turns passive liquidity into enforceable commitments. Instead of depositing
          into an open-ended pool, you define the terms up front (amount, lock duration, the loss
          you tolerate, and the penalty for leaving early) and a Soroban smart contract on Stellar
          enforces them. The web app guides you through creating a commitment and tracking it until
          maturity.
        </p>

        <h2 id="concepts">Core concepts</h2>
        <ul>
          <li>
            <b>Commitment</b>: a record of principal, duration, risk limits and penalty.
          </li>
          <li>
            <b>Maturity</b>: the timestamp at which the lock ends and the commitment can be settled
            in full.
          </li>
          <li>
            <b>Max loss</b>: the drawdown the owner accepts. Exceeding it is a violation that can be
            attested.
          </li>
          <li>
            <b>Early exit penalty</b>: the percentage of principal forfeited when leaving before
            maturity.
          </li>
          <li>
            <b>Attestation</b>: an on-chain event that records compliance or violation.
          </li>
        </ul>

        <h2 id="lifecycle">Commitment lifecycle</h2>
        <ol>
          <li>
            <b>Create</b>: choose a type, asset, amount and duration on the{' '}
            <Link href="/create">Create</Link> page and review the terms.
          </li>
          <li>
            <b>Active</b>: funds are locked. Progress and time to maturity show on the{' '}
            <Link href="/dashboard">Dashboard</Link>.
          </li>
          <li>
            <b>Matured</b>: the lock has ended. Settle to receive principal plus yield.
          </li>
          <li>
            <b>Settled / Exited</b>: terminal states. Early exit applies the stated penalty.
          </li>
        </ol>

        <h2 id="types">Commitment types</h2>
        <DocsTypesTable />

        <h2 id="contracts">Contracts</h2>
        <p>Network: Stellar {NETWORK}. Contract source lives in the repository under contracts/.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Contract</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Escrow</td>
                <td>
                  {ESCROW_CONTRACT_ID ? (
                    <a href={explorerContractUrl(ESCROW_CONTRACT_ID)} target="_blank" rel="noreferrer">
                      <code>{ESCROW_CONTRACT_ID}</code>
                    </a>
                  ) : (
                    'Not deployed yet'
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 id="setup">Run locally</h2>
        <pre>
          <code>{`git clone ${REPO_URL}.git
cd Commitlabs-Frontend
npm install
cp .env.example .env.local
npm run dev   # http://localhost:3000`}</code>
        </pre>

        <h2 id="env">Environment variables</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Default</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>NEXT_PUBLIC_STELLAR_NETWORK</code>
                </td>
                <td>{config.network}</td>
                <td>Network identifier (testnet | futurenet | mainnet)</td>
              </tr>
              <tr>
                <td>
                  <code>NEXT_PUBLIC_HORIZON_URL</code>
                </td>
                <td>{config.horizonUrl.replace(/^https?:\/\//, '')}</td>
                <td>Wallet balance lookups</td>
              </tr>
              <tr>
                <td>
                  <code>NEXT_PUBLIC_SOROBAN_RPC_URL</code>
                </td>
                <td>{config.sorobanRpcUrl.replace(/^https?:\/\//, '')}</td>
                <td>Soroban RPC endpoint</td>
              </tr>
              <tr>
                <td>
                  <code>NEXT_PUBLIC_ESCROW_CONTRACT_ID</code>
                </td>
                <td>empty</td>
                <td>Deployed escrow contract address</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 id="faq">FAQ</h2>
        <h3>Do I need a wallet?</h3>
        <p>
          No. Wallet connection through Freighter is optional and only adds your{' '}
          {config.networkDetails.label.toLowerCase()} balance. If the extension is missing the app
          keeps working in demo mode.
        </p>
        <h3>Where are my commitments stored?</h3>
        <p>
          In demo mode they are stored in your browser&apos;s local storage. Nothing is sent to a
          server.
        </p>
        <h3>Is this mainnet?</h3>
        <p>
          {config.network === 'mainnet'
            ? 'Yes. This deployment targets Stellar mainnet.'
            : `No. Everything targets Stellar ${config.networkDetails.label.toLowerCase()} and uses test funds only.`}
        </p>
      </div>
    </section>
  );
}
