export interface ValueHistoryItem {
  date: string
  currentValue: number
  initialAmount: number
}

export interface DrawdownHistoryItem {
  date: string
  drawdownPercent: number
}

export interface ComputeCommitmentExposureParams {
  valueHistory: ValueHistoryItem[]
  drawdownHistory: DrawdownHistoryItem[]
  maxLossPercent: number
}

export interface CommitmentExposureResult {
  currentDrawdownPercent: number
  meanAbsReturn: number
  volatilityExposurePercent: number
  insufficientData: boolean
}

const VOLATILITY_RETURN_SCALE = 1

export function computeVolatilityExposurePercent(
  meanAbsReturn: number,
  protocolMaxLossPercentCeiling: number,
): { percent: number; insufficientData: boolean } {
  if (protocolMaxLossPercentCeiling <= 0) {
    return { percent: 0, insufficientData: true }
  }

  const scale = (VOLATILITY_RETURN_SCALE * 100) / protocolMaxLossPercentCeiling
  const raw = meanAbsReturn * 100 * scale
  const percent = Math.min(100, Math.max(0, raw))

  return { percent, insufficientData: false }
}

export function computeCommitmentExposure(
  params: ComputeCommitmentExposureParams,
): CommitmentExposureResult {
  const { valueHistory, drawdownHistory, maxLossPercent } = params

  const currentDrawdownPercent =
    drawdownHistory.length > 0
      ? drawdownHistory[drawdownHistory.length - 1].drawdownPercent
      : 0

  const meanAbsReturn =
    valueHistory.length > 0
      ? valueHistory.reduce((sum, item) => {
          const return_ =
            (item.currentValue - item.initialAmount) / item.initialAmount
          return sum + Math.abs(return_)
        }, 0) / valueHistory.length
      : 0

  const { percent: volatilityExposurePercent, insufficientData } =
    computeVolatilityExposurePercent(meanAbsReturn, maxLossPercent)

  return {
    currentDrawdownPercent,
    meanAbsReturn,
    volatilityExposurePercent,
    insufficientData,
  }
}
