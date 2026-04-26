'use client'

import React, { useState } from 'react'
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

  const getRiskScore = () => {
    let score = 'Standard Risk Profile'
    let level = 'standard' // 'safe', 'standard', 'high'
    
    if (maxLossPercent > 20 || slippageTolerance > 3 || liquidationBuffer < 3) {
      score = 'High Risk Configuration'
      level = 'high'
    } else if (maxLossPercent < 5 && slippageTolerance <= 1 && liquidationBuffer >= 5) {
      score = 'Conservative Risk Configuration'
      level = 'safe'
    }
    return { score, level }
  }

  const handleResetDefaults = () => {
    onChangeMaxLoss(10)
    setSlippageTolerance(1)
    setLiquidationBuffer(5)
  }

  const riskInfo = getRiskScore()

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChangeAmount(e.target.value)
  }

  const handleAssetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChangeAsset(e.target.value)
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
    if (e.key === 'Enter' && isValid) {
      onNext()
    }
  }

  return (
    <div className={styles.configureContainer}>
      <div className={styles.contentWrapper}>
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
                onChange={handleAssetChange}
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

          {/* Duration (days) */}
          <div className={styles.formGroup}>
            <label htmlFor="duration" className={styles.label}>
              Duration (days) <span className={styles.required}>*</span>
              <span className={styles.tooltipIcon} title="The number of days your commitment will be locked">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              </span>
            </label>
            <div className={styles.sliderInputWrapper}>
              <div className={styles.sliderContainer}>
                <input
                  type="range"
                  className={styles.slider}
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
                  className={styles.sliderNumberInput}
                  value={durationDays}
                  onChange={handleDurationInputChange}
                  min="1"
                  max="365"
                  aria-describedby="duration-value"
                />
                <span id="duration-value" className={styles.sliderValueLabel}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {durationDays} days
                </span>
              </div>
            </div>
          </div>

          {/* Advanced Risk Settings Toggle */}
          <div className={styles.advancedToggleContainer}>
            <button
              type="button"
              className={styles.advancedToggleButton}
              onClick={() => setShowAdvanced(!showAdvanced)}
              aria-expanded={showAdvanced}
            >
              <span className={styles.advancedToggleText}>Advanced Risk Parameters</span>
              <svg 
                className={`${styles.advancedToggleIcon} ${showAdvanced ? styles.expanded : ''}`}
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>

          {/* Advanced Settings Area */}
          <div className={`${styles.advancedSection} ${showAdvanced ? styles.advancedSectionOpen : ''}`}>
            
            {/* Risk Score Messaging */}
            <div className={`${styles.riskScoreBanner} ${styles[riskInfo.level]}`}>
              <div className={styles.riskScoreIcon}>
                {riskInfo.level === 'safe' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                )}
                {riskInfo.level === 'standard' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
                {riskInfo.level === 'high' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                )}
              </div>
              <div className={styles.riskScoreContent}>
                <span className={styles.riskScoreTitle}>{riskInfo.score}</span>
                <span className={styles.riskScoreDescription}>
                  {riskInfo.level === 'safe' && 'Highly constrained exposure for maximum principal protection.'}
                  {riskInfo.level === 'standard' && 'Balanced parameters suitable for most typical users.'}
                  {riskInfo.level === 'high' && 'Tuned for aggressive yields with elevated loss potential.'}
                </span>
              </div>
              <button 
                type="button" 
                className={styles.resetDefaultsButton}
                onClick={handleResetDefaults}
                title="Reset to safe defaults"
              >
                Reset
              </button>
            </div>

            {/* Maximum Acceptable Loss (%) */}
            <div className={styles.formGroup}>
              <label htmlFor="maxLoss" className={styles.label}>
                Maximum Acceptable Loss (%)
                <span className={styles.tooltipIcon} title="The maximum percentage loss you are willing to accept">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
                  </svg>
                </span>
              </label>
              <div className={styles.sliderInputWrapper}>
                <div className={styles.sliderContainer}>
                  <input
                    type="range"
                    className={`${styles.slider} ${maxLossWarning ? styles.warningSlider : ''}`}
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
                    className={styles.sliderNumberInput}
                    value={maxLossPercent}
                    onChange={handleMaxLossInputChange}
                    min="0"
                    max="100"
                    aria-describedby="maxloss-value"
                  />
                  <span 
                    id="maxloss-value" 
                    className={`${styles.sliderValueLabel} ${maxLossWarning ? styles.warningLabel : ''}`}
                  >
                    {maxLossWarning && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                    )}
                    {maxLossPercent}% max loss
                  </span>
                </div>
              </div>
            </div>

            {/* Slippage Tolerance (%) */}
            <div className={styles.formGroup}>
              <label htmlFor="slippage" className={styles.label}>
                Slippage Tolerance (%)
                <span className={styles.tooltipIcon} title="Maximum price difference you'll accept on underlying trades">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
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
                    min="0"
                    max="10"
                    step="0.5"
                    aria-label="Slippage slider"
                    style={{
                      background: `linear-gradient(to right, #00d4aa ${(slippageTolerance / 10) * 100}%, #2a2a2a ${(slippageTolerance / 10) * 100}%)`
                    }}
                  />
                </div>
                <div className={styles.sliderBottomRow}>
                  <input
                    id="slippage"
                    type="number"
                    className={styles.sliderNumberInput}
                    value={slippageTolerance}
                    onChange={(e) => setSlippageTolerance(Math.min(10, Math.max(0, Number(e.target.value) || 0)))}
                    min="0"
                    max="10"
                    step="0.1"
                  />
                  <span className={styles.sliderValueLabel}>
                    {slippageTolerance}%
                  </span>
                </div>
              </div>
            </div>

            {/* Liquidation Buffer (%) */}
            <div className={styles.formGroup}>
              <label htmlFor="liquidationBuffer" className={styles.label}>
                Liquidation Buffer (%)
                <span className={styles.tooltipIcon} title="Safety margin before collateral gets liquidated">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" />
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
                    min="1"
                    max="20"
                    aria-label="Liquidation buffer slider"
                    style={{
                      background: `linear-gradient(to right, #00d4aa ${(liquidationBuffer / 20) * 100}%, #2a2a2a ${(liquidationBuffer / 20) * 100}%)`
                    }}
                  />
                </div>
                <div className={styles.sliderBottomRow}>
                  <input
                    id="liquidationBuffer"
                    type="number"
                    className={styles.sliderNumberInput}
                    value={liquidationBuffer}
                    onChange={(e) => setLiquidationBuffer(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                    min="1"
                    max="20"
                  />
                  <span className={styles.sliderValueLabel}>
                    {liquidationBuffer}%
                  </span>
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

          {/* Note Banner */}
          <div className={styles.noteBanner}>
            <span className={styles.noteLabel}>Note: </span>
            <span className={styles.noteText}>
              parameters will be enforced on-chain. Early exits will incur the penalty shown above.
            </span>
          </div>
        </form>

        {/* Footer Actions */}
        <div className={styles.footerActions}>
          <button
            type="button"
            className={styles.backButton}
            onClick={onBack}
          >
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

