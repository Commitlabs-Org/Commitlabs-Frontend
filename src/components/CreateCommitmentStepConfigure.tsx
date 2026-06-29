'use client'

import React, { useState, useRef, useEffect } from 'react'
import WizardStepper from './WizardStepper'
import AllocationConstraintsEditor from './create/AllocationConstraintsEditor'
import CostYieldEstimator from './create/CostYieldEstimator'
import styles from './CreateCommitmentStepConfigure.module.css'
import GlossaryTerm from './GlossaryTerm'

interface ServerFieldErrors {
  amount?: string
  durationDays?: string
  maxLossBps?: string
  ownerAddress?: string
  asset?: string
}

interface CreateCommitmentStepConfigureProps {
  amount: string | number
  asset: string
  availableBalance: string | number
  durationDays: number
  maxLossPercent: number
  earlyExitPenalty: string
  estimatedFees: string
  isValid: boolean
  ownerAddress?: string | undefined
  commitmentType?: 'safe' | 'balanced' | 'aggressive' | undefined
  onChangeAmount: (value: string) => void
  onChangeAsset: (asset: string) => void
  onChangeDuration: (value: number) => void
  onChangeMaxLoss: (value: number) => void
  onBack: () => void
  onNext: () => void
  amountError?: string | undefined
  maxLossWarning?: boolean | undefined
  initialFocusField?: string | undefined
}

// Per-type constraints surfaced as copy
const DURATION_COPY = 'Valid range: 1–365 days. Shorter durations reduce yield potential. Early exit before the end date incurs a penalty.'
const MAX_LOSS_COPY = 'Sets the automatic stop-loss threshold. When your position loses this percentage of its value, it is closed on-chain to prevent further loss. Set to 100% to disable protection.'

export default function CreateCommitmentStepConfigure({
  amount,
  asset,
  availableBalance,
  durationDays,
  maxLossPercent,
  earlyExitPenalty,
  estimatedFees,
  isValid,
  ownerAddress = '',
  commitmentType = 'balanced',
  onChangeAmount,
  onChangeAsset,
  onChangeDuration,
  onChangeMaxLoss,
  onBack,
  onNext,
  amountError,
  maxLossWarning = false,
  initialFocusField,
}: CreateCommitmentStepConfigureProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (initialFocusField) {
      const element = document.getElementById(initialFocusField);
      if (element) {
        element.focus();
        element.scrollIntoView({ block: 'center' });
      }
    }
  }, [initialFocusField]);

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [slippageTolerance, setSlippageTolerance] = useState(1)
  const [liquidationBuffer, setLiquidationBuffer] = useState(5)
  const [serverErrors, setServerErrors] = useState<ServerFieldErrors>({})
  const [serverValidating, setServerValidating] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Debounced server-side validation
  useEffect(() => {
    const timer = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setServerValidating(true)
      try {
        const res = await fetch('/api/commitments/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ownerAddress,
            asset,
            amount,
            durationDays,
            maxLossBps: maxLossPercent * 100,
          }),
          signal: controller.signal,
        })
        const json = await res.json()
        const fieldMap: ServerFieldErrors = {}
        for (const err of json?.data?.errors ?? json?.errors ?? []) {
          if (err.field && err.message) {
            fieldMap[err.field as keyof ServerFieldErrors] = err.message
          }
        }
        setServerErrors(fieldMap)
      } catch {
        // Network failure: clear errors gracefully — don't block the user
        setServerErrors({})
      } finally {
        setServerValidating(false)
      }
    }, 500)
    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [ownerAddress, asset, amount, durationDays, maxLossPercent])

  const hasServerErrors = Object.keys(serverErrors).length > 0
  const canAdvance = isValid && !hasServerErrors && !serverValidating

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  // Inline validation messages
  const durationError =
    durationDays < 1 ? 'Minimum duration is 1 day.' :
    durationDays > 365 ? 'Maximum duration is 365 days.' :
    undefined

  const maxLossError =
    maxLossPercent < 0 ? 'Cannot be negative.' :
    maxLossPercent > 100 ? 'Cannot exceed 100%.' :
    undefined

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChangeAmount(e.target.value)
  }

  const handleDurationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(365, Math.max(1, Number(e.target.value) || 1))
    onChangeDuration(value)
  }

  const handleDurationSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChangeDuration(Number(e.target.value))
  }

  const handleMaxLossInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(100, Math.max(0, Number(e.target.value) || 0))
    onChangeMaxLoss(value)
  }

  const handleMaxLossSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChangeMaxLoss(Number(e.target.value))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canAdvance) onNext()
  }

  return (
    <div className={styles.configureContainer}>
      <div className={styles.contentWrapper}>
        <button type="button" onClick={onBack} className={styles.backButton}>
          ← Back
        </button>

        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Create Commitment</h1>
          <p className={styles.pageSubtitle}>
            Define your liquidity commitment with explicit rules and guarantees
          </p>
        </div>

        <WizardStepper currentStep={2} />

        <div className={styles.sectionHeader}>
          <h2 ref={headingRef} tabIndex={-1} className={styles.sectionTitle}>Configure Parameters</h2>
          <p className={styles.sectionSubtitle}>
            Set your commitment amount, duration, and risk tolerance
          </p>
        </div>

        <form className={styles.form} onKeyDown={handleKeyDown}>
          {/* Commitment Amount */}
          <div className={styles.formGroup}>
            <label htmlFor="amount" className={styles.label}>
              Commitment Amount <span className={styles.required}>*</span>
            </label>
            <div className={`${styles.amountInputWrapper} ${amountError || serverErrors.amount ? styles.hasError : ''}`}>
              <span className={styles.currencyPrefix}>$</span>
              <input
                id="amount"
                type="number"
                className={styles.amountInput}
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                min="0"
                step="0.01"
                aria-describedby="amount-helper amount-error"
                aria-invalid={!!(amountError || serverErrors.amount)}
              />
              <select
                className={styles.assetSelector}
                value={asset}
                onChange={(e) => onChangeAsset(e.target.value)}
                aria-label="Select asset"
              >
                <option value="XLM">XLM</option>
                <option value="USDC">USDC</option>
                <option value="ETH">ETH</option>
              </select>
            </div>
            <div className={styles.helperRow}>
              <span id="amount-helper" className={styles.helperText}>
                Available: {availableBalance} {asset}
              </span>
              {(amountError || serverErrors.amount) && (
                <span id="amount-error" className={styles.errorText} role="alert">
                  {amountError ?? serverErrors.amount}
                </span>
              )}
            </div>
          </div>

          {/* Duration */}
          <div className={styles.formGroup}>
            <label htmlFor="duration" className={styles.label}>
              Duration (days) <span className={styles.required}>*</span>
            </label>
            <div className={styles.sliderInputWrapper}>
              <div className={styles.sliderContainer}>
                <input
                  type="range"
                  className={`${styles.slider} ${durationError ? styles.errorSlider : ''}`}
                  value={durationDays}
                  onChange={handleDurationSliderChange}
                  min="1"
                  max="365"
                  aria-label="Duration slider"
                  style={{
                    background: `linear-gradient(to right, #00d4aa ${(durationDays / 365) * 100}%, #2a2a2a ${(durationDays / 365) * 100}%)`
                  }}
                />
              </div>
              <div className={styles.sliderBottomRow}>
                <input
                  id="duration"
                  type="number"
                  className={`${styles.sliderNumberInput} ${durationError || serverErrors.durationDays ? styles.inputError : ''}`}
                  value={durationDays}
                  onChange={handleDurationInputChange}
                  min="1"
                  max="365"
                  aria-describedby="duration-hint duration-error"
                  aria-invalid={!!(durationError || serverErrors.durationDays)}
                />
                <span className={styles.sliderValueLabel}>
                  {durationDays} days
                </span>
              </div>
            </div>
            {durationError || serverErrors.durationDays ? (
              <span id="duration-error" className={styles.errorText} role="alert">{durationError ?? serverErrors.durationDays}</span>
            ) : (
              <p id="duration-hint" className={styles.constraintHint}>{DURATION_COPY}</p>
            )}
          </div>

          {/* Max Loss — promoted out of Advanced */}
          <div className={styles.formGroup}>
            <label htmlFor="maxLoss" className={styles.label}>
              <GlossaryTerm termKey="max loss threshold">Maximum Acceptable Loss (%)</GlossaryTerm>
              <span className={styles.required}>*</span>
            </label>
            <div className={styles.sliderInputWrapper}>
              <div className={styles.sliderContainer}>
                <input
                  type="range"
                  className={`${styles.slider} ${maxLossWarning ? styles.warningSlider : ''} ${maxLossError ? styles.errorSlider : ''}`}
                  value={maxLossPercent}
                  onChange={handleMaxLossSliderChange}
                  min="0"
                  max="100"
                  aria-label="Maximum loss slider"
                  style={{
                    background: maxLossWarning
                      ? `linear-gradient(to right, #f5a623 ${maxLossPercent}%, #2a2a2a ${maxLossPercent}%)`
                      : `linear-gradient(to right, #00d4aa ${maxLossPercent}%, #2a2a2a ${maxLossPercent}%)`
                  }}
                />
              </div>
              <div className={styles.sliderBottomRow}>
                <input
                  id="maxLoss"
                  type="number"
                  className={`${styles.sliderNumberInput} ${maxLossError || serverErrors.maxLossBps ? styles.inputError : ''}`}
                  value={maxLossPercent}
                  onChange={handleMaxLossInputChange}
                  min="0"
                  max="100"
                  aria-describedby={
                    [
                      !maxLossError && !maxLossWarning ? 'maxloss-hint' : undefined,
                      maxLossWarning && !maxLossError ? 'maxloss-warning' : undefined,
                      maxLossError ? 'maxloss-error' : undefined,
                    ]
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                  aria-invalid={!!(maxLossError || serverErrors.maxLossBps)}
                />
                <span className={`${styles.sliderValueLabel} ${maxLossWarning ? styles.warningLabel : ''}`}>
                  {maxLossWarning && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  )}
                  {maxLossPercent}% max loss
                </span>
              </div>
            </div>
            {maxLossError || serverErrors.maxLossBps ? (
              <span id="maxloss-error" className={styles.errorText} role="alert">{maxLossError ?? serverErrors.maxLossBps}</span>
            ) : maxLossWarning ? (
              <p id="maxloss-warning" className={styles.warningHint}>
                ⚠ Setting max loss above 80% means most of your committed amount could be lost before the position closes.
              </p>
            ) : (
              <p id="maxloss-hint" className={styles.constraintHint}>{MAX_LOSS_COPY}</p>
            )}
          </div>

          {/* Allocation Constraints Editor */}
          <AllocationConstraintsEditor
            maxLossPercent={maxLossPercent}
            commitmentType={commitmentType}
            amount={amount}
            asset={asset}
            onChangeMaxLoss={onChangeMaxLoss}
          />

          {/* Live Cost and Yield Estimator */}
          <CostYieldEstimator
            amount={amount}
            durationDays={durationDays}
            maxLossPercent={maxLossPercent}
            asset={asset}
          />

          {/* Advanced Risk Settings */}
          <div className={styles.advancedToggleContainer}>
            <button
              type="button"
              className={styles.advancedToggleButton}
              onClick={() => setShowAdvanced(!showAdvanced)}
              aria-expanded={showAdvanced}
              data-testid="advanced-toggle"
            >
              <span>Advanced Risk Parameters</span>
              <svg
                className={`${styles.advancedToggleIcon} ${showAdvanced ? styles.expanded : ''}`}
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>

          <div className={`${styles.advancedSection} ${showAdvanced ? styles.advancedSectionOpen : ''}`}>
            {/* Slippage Tolerance */}
            <div className={styles.formGroup}>
              <label htmlFor="slippage" className={styles.label}>
                Slippage Tolerance (%)
                <span className={styles.tooltipIcon} title="Maximum price difference you'll accept on underlying trades">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                  </svg>
                </span>
              </label>
              <div className={styles.sliderInputWrapper}>
                <div className={styles.sliderContainer}>
                  <input
                    type="range"
                    className={styles.slider}
                    value={slippageTolerance}
                    onChange={(e) => setSlippageTolerance(Number(e.target.value))}
                    min="0" max="10" step="0.5"
                    style={{ background: `linear-gradient(to right, #00d4aa ${(slippageTolerance / 10) * 100}%, #2a2a2a ${(slippageTolerance / 10) * 100}%)` }}
                  />
                </div>
                <div className={styles.sliderBottomRow}>
                  <input
                    id="slippage"
                    type="number"
                    className={styles.sliderNumberInput}
                    value={slippageTolerance}
                    onChange={(e) => setSlippageTolerance(Math.min(10, Math.max(0, Number(e.target.value) || 0)))}
                    min="0" max="10" step="0.1"
                  />
                  <span className={styles.sliderValueLabel}>{slippageTolerance}%</span>
                </div>
              </div>
            </div>

            {/* Liquidation Buffer */}
            <div className={styles.formGroup}>
              <label htmlFor="liquidationBuffer" className={styles.label}>
                Liquidation Buffer (%)
                <span className={styles.tooltipIcon} title="Safety margin before collateral gets liquidated">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                  </svg>
                </span>
              </label>
              <div className={styles.sliderInputWrapper}>
                <div className={styles.sliderContainer}>
                  <input
                    type="range"
                    className={styles.slider}
                    value={liquidationBuffer}
                    onChange={(e) => setLiquidationBuffer(Number(e.target.value))}
                    min="1" max="20"
                    style={{ background: `linear-gradient(to right, #00d4aa ${(liquidationBuffer / 20) * 100}%, #2a2a2a ${(liquidationBuffer / 20) * 100}%)` }}
                  />
                </div>
                <div className={styles.sliderBottomRow}>
                  <input
                    id="liquidationBuffer"
                    type="number"
                    className={styles.sliderNumberInput}
                    value={liquidationBuffer}
                    onChange={(e) => setLiquidationBuffer(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                    min="1" max="20"
                  />
                  <span className={styles.sliderValueLabel}>{liquidationBuffer}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Derived Values */}
          <div className={styles.derivedSection} data-testid="derived-section">
            <div className={styles.derivedRow}>
              <span className={styles.derivedLabel}><GlossaryTerm termKey="early exit">Early Exit Penalty</GlossaryTerm></span>
              <span className={styles.derivedValue}>{earlyExitPenalty}</span>
            </div>
            <div className={styles.derivedRow}>
              <span className={styles.derivedLabel}>Estimated Fees</span>
              <span className={styles.derivedValue}>{estimatedFees}</span>
            </div>
          </div>

          <div className={styles.noteBanner}>
            <span className={styles.noteLabel}>Note: </span>
            <span className={styles.noteText}>
              All parameters are enforced on-chain and cannot be changed after creation. Early exits will incur the penalty shown above.
            </span>
          </div>
        </form>

        <div className={styles.footerActions}>
          <button type="button" className={styles.footerBackButton} onClick={onBack}>
            Back
          </button>
          <button
            type="button"
            className={styles.continueButton}
            onClick={onNext}
            disabled={!canAdvance}
            aria-disabled={!canAdvance}
            data-testid="configure-continue"
          >
            {serverValidating ? 'Validating…' : 'Continue'}
            {!serverValidating && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
