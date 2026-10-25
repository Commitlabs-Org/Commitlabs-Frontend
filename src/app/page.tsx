'use client';

import Link from 'next/link';
import { TYPES } from '@/lib/commitments';
import { config } from '@/lib/config';
import { useProtocolParams } from '@/lib/protocol';
import { DISPLAY_APY } from '@/lib/yield';
import { Skeleton } from '@/components/Skeleton';

const STEPS = [
  {
    n: '01',
    title: 'Define your commitment',
    body: 'Choose an asset, amount, lock duration, a maximum loss you accept and the early-exit penalty.',
  },
  {
    n: '02',
    title: 'Lock it on-chain',
    body: 'Terms are enforced by a Soroban escrow contract. No custodian, no off-chain promises.',
  },
  {
    n: '03',
    title: 'Settle or exit',
    body: 'At maturity settle in full with yield. Leave early and the penalty is applied by the contract.',
  },
];

const FEATURES = [
  ['Enforceable', 'Rules live in a smart contract, not a terms page.'],
  ['Attestable', 'Every state change emits events anyone can verify on-chain.'],
  ['Composable', 'Commitments are standard on-chain records other protocols can build on.'],
  ['Transparent', `Open source UI and contracts, deployed on Stellar ${config.networkDetails.label.toLowerCase()}.`],
];

export default function Home() {
  const { params, loading, isFallback } = useProtocolParams();
  return (
    <>
      <section className="hero">
        <div className="container">
          <span className="pill">{config.networkDetails.badgeLabel}</span>
          <h1>
            Liquidity as a <span className="grad">commitment</span>
          </h1>
          <p className="lead">
            Turn passive liquidity into enforceable, attestable and composable on-chain commitments.
            Pick your risk, lock your terms, and let the contract keep everyone honest.
          </p>
          <div className="row center-row">
            <Link href="/create" className="btn btn-primary btn-lg">
              Create a commitment
            </Link>
            <Link href="/docs" className="btn btn-ghost btn-lg">
              Read the docs
            </Link>
          </div>
          <dl className="stats">
            <div>
              <dt>Network</dt>
              <dd>Stellar Soroban</dd>
            </div>
            <div>
              <dt>Commitment types</dt>
              <dd>{TYPES.length}</dd>
            </div>
            <div>
              <dt>Custody</dt>
              <dd>Non-custodial</dd>
            </div>
            <div>
              <dt>License</dt>
              <dd>Open source</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="container section">
        <h2>How it works</h2>
        <div className="grid3">
          {STEPS.map((s) => (
            <article className="card" key={s.n}>
              <span className="step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p className="muted">{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container section">
        <h2>Choose your risk profile</h2>
        {isFallback && (
          <p className="muted small" role="note" style={{ marginBottom: '1rem' }}>
            Could not verify on-chain parameters. Displaying default protocol parameters.
          </p>
        )}
        <div className="grid3">
          {TYPES.map((t) => (
            <article className="card type-card" key={t.id}>
              <h3>{t.name}</h3>
              <p className="muted">{t.tagline}</p>
              <ul className="kv">
                <li>
                  <span>Target APY</span>
                  <b>{DISPLAY_APY[t.id]}%</b>
                </li>
                <li>
                  <span>Max loss</span>
                  <b>{t.maxLoss}%</b>
                </li>
                <li>
                  <span>Early exit penalty</span>
                  {loading ? (
                    <Skeleton width="60px" height="20px" />
                  ) : (
                    <b>{params.penalties[t.id] / 100}%</b>
                  )}
                </li>
                <li>
                  <span>Minimum lock</span>
                  <b>{t.minDays} days</b>
                </li>
              </ul>
              <Link href={`/create?type=${t.id}`} className="btn btn-ghost">
                Start with {t.name}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="container section">
        <h2>Why commitments</h2>
        <div className="grid4">
          {FEATURES.map(([t, b]) => (
            <article className="card" key={t}>
              <h3>{t}</h3>
              <p className="muted">{b}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="cta">
          <h2>Ready to commit?</h2>
          <p className="muted">Create your first commitment in under a minute. No wallet required to try the demo.</p>
          <Link href="/create" className="btn btn-primary btn-lg">
            Get started
          </Link>
        </div>
      </section>
    </>
  );
}
