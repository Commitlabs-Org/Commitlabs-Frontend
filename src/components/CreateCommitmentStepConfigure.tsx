'use client'

import React, { useState } from 'react'
import WizardStepper from './WizardStepper'
import styles from './CreateCommitmentStepConfigure.module.css'

interface CreateCommitmentStepConfigureProps {
  amount: string | number
  asset: string
  availableBalance: string | number
  durationDays: number
  maxLossPercent: number
  earlyExitPenalty: string
  estimatedFees: string
  isValid: boolean
  onChangeAmount: (value: string) => void
  onChangeAsset: (asset: string) => void
  onChangeDuration: (value: number) => void
  onChangeMaxLoss: (value: number) => void
  onBack: () => void
  onNext: () => void
  amountError?: string
  maxLossWarning?: boolean
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
  onChangeAmount,
  onChangeAsset,
  onChangeDuration,
  onChangeMaxLoss,
  onBack,
  onNext,
  amountError,
  maxLossWarning = false,
}: CreateCommitmentStepConfigureProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [slippageTolerance, setSlippageTolerance] = useState(1)
  const [liquidationBuffer, setLiquidationBuffer] = useState(5)

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
    if (e.key === 'Enter' && isValid) onNext()
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
          <h2 className={styles.sectionTitle}>Configure Parameters</h2>
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
            <div className={`${styles.amountInputWrapper} ${amountError ? styles.hasError : ''}`}>
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
                aria-invalid={!!amountError}
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
              {amountError && (
                <span id="amount-error" className={styles.errorText} role="alert">
                  {amountError}
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
                  className={`${styles.sliderNumberInput} ${durationError ? styles.inputError : ''}`}
                  value={durationDays}
                  onChange={handleDurationInputChange}
                  min="1"
                  max="365"
                  aria-describedby="duration-hint duration-error"
                  aria-invalid={!!durationError}
                />
                <span className={styles.sliderValueLabel}>
                  {durationDays} days
                </span>
              </div>
            </div>
            {durationError ? (
              <span id="duration-error" className={styles.errorText} role="alert">{durationError}</span>
            ) : (
              <p id="duration-hint" className={styles.constraintHint}>{DURATION_COPY}</p>
            )}
          </div>

          {/* Max Loss — promoted out of Advanced */}
          <div className={styles.formGroup}>
            <label htmlFor="maxLoss" className={styles.label}>
              Maximum Acceptable Loss (%)
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
                  className={`${styles.sliderNumberInput} ${maxLossError ? styles.inputError : ''}`}
                  value={maxLossPercent}
                  onChange={handleMaxLossInputChange}
                  min="0"
                  max="100"
                  aria-describedby="maxloss-hint maxloss-error"
                  aria-invalid={!!maxLossError}
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
            {maxLossError ? (
              <span id="maxloss-error" className={styles.errorText} role="alert">{maxLossError}</span>
            ) : maxLossWarning ? (
              <p className={styles.warningHint}>
                ⚠ Setting max loss above 80% means most of your committed amount could be lost before the position closes.
              </p>
            ) : (
              <p id="maxloss-hint" className={styles.constraintHint}>{MAX_LOSS_COPY}</p>
            )}
          </div>

          {/* Advanced Risk Settings */}
          <div className={styles.advancedToggleContainer}>
            <button
              type="button"
              className={styles.advancedToggleButton}
              onClick={() => setShowAdvanced(!showAdvanced)}
              aria-expanded={showAdvanced}
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
          <div className={styles.derivedSection}>
            <div className={styles.derivedRow}>
              <span className={styles.derivedLabel}>Early Exit Penalty</span>
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
            disabled={!isValid}
            aria-disabled={!isValid}
          >
            Continue
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
