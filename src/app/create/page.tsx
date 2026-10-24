'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  AMOUNT_ERROR_MESSAGES,
  MAX_AMOUNT,
  formatAmount,
  parseAmount,
  parseDays,
  type DaysError,
} from '@/lib/amount';
import {
  TYPES,
  fmtUnits,
  loadCommitments,
  newId,
  saveCommitments,
  specFor,
  type Commitment,
  type CommitmentType,
} from '@/lib/commitments';
import { useWallet } from '@/components/WalletProvider';
import { useProtocolStatus } from '@/components/ProtocolStatusProvider';
import { getActionPauseReason } from '@/lib/soroban/protocol-policy';
import { ESCROW_CONTRACT_ID, explorerContractUrl, config } from '@/lib/config';
import { useProtocolParams } from '@/lib/protocol';
import {
  DISPLAY_APY,
  MAX_DURATION_DAYS,
  MIN_DURATION_DAYS,
  projectYieldStroops,
} from '@/lib/yield';
import { Skeleton } from '@/components/Skeleton';

const ASSETS = ['USDC', 'XLM', 'EURC'];
const STEP_LABELS = ['Type', 'Configure', 'Review', 'Done'];

function daysMessage(reason: DaysError, minDays: number): string {
  switch (reason) {
    case 'empty':
      return 'Enter the lock duration in days.';
    case 'invalid_characters':
      return 'Use whole days only, digits 0 to 9.';
    case 'below_min':
      return `Minimum lock is ${minDays} day${minDays === 1 ? '' : 's'}.`;
    case 'above_max':
      return `Maximum lock is ${MAX_DURATION_DAYS} days.`;
  }
}

export default function CreatePage() {
  const { address } = useWallet();
  const protocolStatus = useProtocolStatus();
  const isPaused = protocolStatus.status === 'ok' && protocolStatus.paused;
  const pauseReason = getActionPauseReason('create_commitment', isPaused);
  const { params, loading: paramsLoading, isFallback } = useProtocolParams();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<CommitmentType>('balanced');
  const [asset, setAsset] = useState('USDC');
  const [amount, setAmount] = useState('1000');
  const [days, setDays] = useState('30');
  const [agree, setAgree] = useState(false);
  const [created, setCreated] = useState<Commitment | null>(null);
  const [amountTouched, setAmountTouched] = useState(false);
  const [daysTouched, setDaysTouched] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const typeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const amountRef = useRef<HTMLInputElement>(null);
  const daysRef = useRef<HTMLInputElement>(null);
  const prevStep = useRef(0);

  // On step change: move focus to the new heading and announce it. Comparing with the
  // previous step makes this a no-op on mount and on strict-mode effect replays.
  useEffect(() => {
    if (prevStep.current === step) return;
    prevStep.current = step;
    headingRef.current?.focus();
    setAnnouncement(`Step ${step + 1} of ${STEP_LABELS.length}: ${STEP_LABELS[step]}`);
  }, [step]);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('type');
    if (t === 'safe' || t === 'balanced' || t === 'aggressive') {
      setType(t);
      setDays(String(specFor(t).minDays));
    }
  }, []);

  const spec = specFor(type);
  const currentApy = DISPLAY_APY[type];
  const penaltyBps = params.penalties[type];
  const currentPenaltyPct = penaltyBps / 100;

  // Exact fixed-point parsing; yield and penalty use the contract's integer math.
  const parsedAmount = parseAmount(amount);
  const parsedDays = parseDays(days, { min: MIN_DURATION_DAYS, max: MAX_DURATION_DAYS });
  const amountErr = parsedAmount.ok ? null : AMOUNT_ERROR_MESSAGES[parsedAmount.reason];
  const daysErr = parsedDays.ok ? null : daysMessage(parsedDays.reason, MIN_DURATION_DAYS);
  const amt = parsedAmount.ok ? parsedAmount.value : 0n;
  const dur = parsedDays.ok ? parsedDays.value : 0;
  const valid = parsedAmount.ok && parsedDays.ok;
  const projected = valid ? projectYieldStroops(amt, dur, type) : 0n;
  const penalty = valid ? (amt * BigInt(penaltyBps)) / 10_000n : 0n;

  function pickType(t: CommitmentType) {
    setType(t);
  }

  function submit() {
    const c: Commitment = {
      id: newId(),
      type,
      asset,
      amount: amt.toString(),
      durationDays: dur,
      maxLoss: spec.maxLoss,
      penalty: currentPenaltyPct,
      apy: currentApy,
      createdAt: Date.now(),
      status: 'active',
      owner: address,
      txHash: null,
    };
    saveCommitments([c, ...loadCommitments().items]);
    setCreated(c);
    setStep(3);
  }

  function onTypeKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % TYPES.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      next = (index - 1 + TYPES.length) % TYPES.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TYPES.length - 1;
    else return;
    e.preventDefault();
    pickType(TYPES[next].id);
    typeRefs.current[next]?.focus();
  }

  function goReview() {
    if (!valid) {
      setAttempted(true);
      (amountErr ? amountRef : daysRef).current?.focus();
      return;
    }
    setStep(2);
  }

  const showAmountErr = amountErr && (attempted || amountTouched);
  const showDaysErr = daysErr && (attempted || daysTouched);
  const describedBy = (hint: string, err: string | boolean | null | undefined) =>
    err ? `${hint} ${hint}-err` : hint;

  return (
    <section className="container page narrow">
      <h1>Create a commitment</h1>
      <ol className="steps" aria-label="Progress">
        {STEP_LABELS.map((l, i) => (
          <li
            key={l}
            className={i === step ? 'on' : i < step ? 'done' : ''}
            aria-current={i === step ? 'step' : undefined}
          >
            <span aria-hidden="true">{i + 1}</span> {l}
            {i < step && <em className="sr-only"> (completed)</em>}
          </li>
        ))}
      </ol>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {step === 0 && (
        <div className="stack">
          <h2 ref={headingRef} tabIndex={-1} id="type-heading">
            Choose a commitment type
          </h2>
          <div className="grid3" role="radiogroup" aria-labelledby="type-heading">
            {TYPES.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  typeRefs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={type === t.id}
                tabIndex={type === t.id ? 0 : -1}
                className={`card pick ${type === t.id ? 'selected' : ''}`}
                onClick={() => pickType(t.id)}
                onKeyDown={(e) => onTypeKeyDown(e, i)}
              >
                <h3>{t.name}</h3>
                <p className="muted">{t.tagline}</p>
                <b>{DISPLAY_APY[t.id]}% APY</b>
              </button>
            ))}
          </div>
          <div className="row end">
            <button className="btn btn-primary" onClick={() => setStep(1)}>
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="card stack">
          <h2 ref={headingRef} tabIndex={-1}>
            Configure
          </h2>
          {isFallback && (
            <p className="muted small" role="note">
              Could not verify on-chain parameters. Displaying default protocol parameters.
            </p>
          )}
          <label>
            Asset
            <select value={asset} onChange={(e) => setAsset(e.target.value)}>
              {ASSETS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <div className="field">
            <label>
              Amount
              <input
                ref={amountRef}
                inputMode="decimal"
                pattern="\d+(\.\d+)?"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={() => setAmountTouched(true)}
                aria-invalid={!!showAmountErr}
                aria-describedby={describedBy('amount', showAmountErr)}
              />
            </label>
            <small id="amount" className="muted">
              Digits and an optional decimal point, up to 7 decimals (max {formatAmount(MAX_AMOUNT)} {asset}).
            </small>
            {showAmountErr && (
              <small id="amount-err" className="err">
                {amountErr}
              </small>
            )}
          </div>
          <div className="field">
            <label>
              Lock duration (days)
              <input
                ref={daysRef}
                inputMode="numeric"
                pattern="\d+"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                onBlur={() => setDaysTouched(true)}
                aria-invalid={!!showDaysErr}
                aria-describedby={describedBy('days', showDaysErr)}
              />
            </label>
            <small id="days" className="muted">
              Whole days, from {MIN_DURATION_DAYS} to {MAX_DURATION_DAYS} (recommended for {spec.name}: {spec.minDays}+ days).
            </small>
            {showDaysErr && (
              <small id="days-err" className="err">
                {daysErr}
              </small>
            )}
          </div>
          <ul className="kv">
            <li>
              <span>Max loss tolerance</span>
              <b>{spec.maxLoss}%</b>
            </li>
            <li>
              <span>Early exit penalty</span>
              {paramsLoading ? (
                <Skeleton width="60px" height="20px" />
              ) : (
                <b>{currentPenaltyPct}%</b>
              )}
            </li>
            <li>
              <span>Projected yield</span>
              <b>
                {fmtUnits(projected)} {asset}
              </b>
            </li>
          </ul>
          <div className="row between">
            <button className="btn btn-ghost" onClick={() => setStep(0)}>
              Back
            </button>
            <button className="btn btn-primary" onClick={goReview}>
              Review
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card stack">
          <h2 ref={headingRef} tabIndex={-1}>
            Review
          </h2>
          {isFallback && (
            <p className="muted small" role="note">
              Could not verify on-chain parameters. Displaying default protocol parameters.
            </p>
          )}
          <ul className="kv">
            <li>
              <span>Type</span>
              <b>{spec.name}</b>
            </li>
            <li>
              <span>Principal</span>
              <b>
                {formatAmount(amt)} {asset}
              </b>
            </li>
            <li>
              <span>Duration</span>
              <b>{dur} days</b>
            </li>
            <li>
              <span>Target APY</span>
              <b>{currentApy}%</b>
            </li>
            <li>
              <span>Projected yield</span>
              <b>
                {formatAmount(projected)} {asset}
              </b>
            </li>
            <li>
              <span>Early exit penalty</span>
              {paramsLoading ? (
                <Skeleton width="120px" height="20px" />
              ) : (
                <b>
                  {currentPenaltyPct}% ({formatAmount(penalty)} {asset})
                </b>
              )}
            </li>
          </ul>
          <label className="check">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            I understand leaving early applies the penalty and these terms cannot be changed.
          </label>
          <p className="muted small">
            Demo mode: the commitment is recorded in this browser. On-chain submission to the{' '}
            {config.networkDetails.label.toLowerCase()} escrow contract is enabled once a contract ID is configured
            {ESCROW_CONTRACT_ID ? '.' : ' (none set in this deployment).'}
          </p>
          <div className="row between wrap">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>
              Back
            </button>
            <div className="row end wrap" style={{ gap: '12px', alignItems: 'center' }}>
              {isPaused && (
                <span className="err small" role="status">
                  {pauseReason}
                </span>
              )}
              <button
                className="btn btn-primary"
                disabled={!agree || isPaused}
                onClick={submit}
                title={isPaused ? pauseReason : undefined}
              >
                Create commitment
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && created && (
        <div className="card stack center">
          <div className="check-big" aria-hidden="true">
            &#10003;
          </div>
          <h2 ref={headingRef} tabIndex={-1}>
            Commitment created
          </h2>
          <p className="muted">
            {created.id} &middot; {formatAmount(BigInt(created.amount))} {created.asset} for {created.durationDays}{' '}
            days
          </p>
          {ESCROW_CONTRACT_ID && (
            <a href={explorerContractUrl(ESCROW_CONTRACT_ID)} target="_blank" rel="noreferrer">
              View escrow contract on Stellar Expert
            </a>
          )}
          <div className="row center-row">
            <Link href="/dashboard" className="btn btn-primary">
              Go to dashboard
            </Link>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setStep(0);
                setAgree(false);
                setCreated(null);
              }}
            >
              Create another
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
