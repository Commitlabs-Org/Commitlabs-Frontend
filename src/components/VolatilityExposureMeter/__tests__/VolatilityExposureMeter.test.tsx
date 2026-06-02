// @vitest-environment happy-dom

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import VolatilityExposureMeter, {
  clamp,
  getThresholdZone,
  getExposureLevel,
  THRESHOLD_ZONES,
} from '../VolatilityExposureMeter'

// =============================================================================
// Helper unit tests
// =============================================================================

describe('clamp', () => {
  it('returns 0 for NaN', () => {
    expect(clamp(NaN)).toBe(0)
  })

  it('returns 0 for non-number (undefined branching)', () => {
    // @ts-expect-error testing runtime edge-case
    expect(clamp(undefined)).toBe(0)
  })

  it('clamps negative values to 0', () => {
    expect(clamp(-10)).toBe(0)
  })

  it('clamps values above 100 to 100', () => {
    expect(clamp(150)).toBe(100)
  })

  it('passes through values within range', () => {
    expect(clamp(0)).toBe(0)
    expect(clamp(33)).toBe(33)
    expect(clamp(50)).toBe(50)
    expect(clamp(66)).toBe(66)
    expect(clamp(100)).toBe(100)
  })
})

describe('getThresholdZone', () => {
  it('returns safe zone for 0 to 33', () => {
    expect(getThresholdZone(0).id).toBe('safe')
    expect(getThresholdZone(33).id).toBe('safe')
  })

  it('returns caution zone for 34 to 66', () => {
    expect(getThresholdZone(34).id).toBe('caution')
    expect(getThresholdZone(66).id).toBe('caution')
  })

  it('returns danger zone for 67 to 100', () => {
    expect(getThresholdZone(67).id).toBe('danger')
    expect(getThresholdZone(100).id).toBe('danger')
  })

  it('clamps out-of-range input before determining zone', () => {
    expect(getThresholdZone(-5).id).toBe('safe')
    expect(getThresholdZone(200).id).toBe('danger')
  })
})

describe('getExposureLevel', () => {
  it('returns low for 33 or less', () => {
    expect(getExposureLevel(0)).toBe('low')
    expect(getExposureLevel(33)).toBe('low')
  })

  it('returns medium for 34 to 66', () => {
    expect(getExposureLevel(34)).toBe('medium')
    expect(getExposureLevel(66)).toBe('medium')
  })

  it('returns high for 67 or more', () => {
    expect(getExposureLevel(67)).toBe('high')
    expect(getExposureLevel(100)).toBe('high')
  })
})

describe('THRESHOLD_ZONES', () => {
  it('has exactly three zones', () => {
    expect(THRESHOLD_ZONES).toHaveLength(3)
  })

  it('each zone has required properties', () => {
    for (const zone of THRESHOLD_ZONES) {
      expect(zone).toHaveProperty('id')
      expect(zone).toHaveProperty('label')
      expect(zone).toHaveProperty('rangeMin')
      expect(zone).toHaveProperty('rangeMax')
      expect(zone).toHaveProperty('annotation')
      expect(zone).toHaveProperty('tooltip')
    }
  })

  it('zones cover 0 to 100 without gaps', () => {
    expect(THRESHOLD_ZONES[0].rangeMin).toBe(0)
    expect(THRESHOLD_ZONES[0].rangeMax).toBe(33)
    expect(THRESHOLD_ZONES[1].rangeMin).toBe(33)
    expect(THRESHOLD_ZONES[1].rangeMax).toBe(66)
    expect(THRESHOLD_ZONES[2].rangeMin).toBe(66)
    expect(THRESHOLD_ZONES[2].rangeMax).toBe(100)
  })
})

// =============================================================================
// Component render tests
// =============================================================================

function renderMeter(props?: Record<string, unknown>) {
  return render(
    React.createElement(VolatilityExposureMeter, {
      valuePercent: 50,
      ...props,
    }),
  )
}

describe('VolatilityExposureMeter (component)', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the meter with default heading', () => {
    renderMeter()
    expect(screen.getByText('Volatility Exposure')).toBeTruthy()
  })

  it('renders the percentage value', () => {
    renderMeter({ valuePercent: 42 })
    expect(screen.getByText('42%')).toBeTruthy()
  })

  it('clamps percentage in the display', () => {
    renderMeter({ valuePercent: 999 })
    expect(screen.getByText('100%')).toBeTruthy()
  })

  it('renders description when provided', () => {
    const desc = 'Test description for accessibility.'
    renderMeter({ description: desc })
    expect(screen.getByText(desc)).toBeTruthy()
  })

  it('does not render description when omitted', () => {
    const { container } = renderMeter({ description: undefined })
    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs.length).toBe(0)
  })

  // Risk profile badge

  it('renders risk profile badge when riskProfileId is provided', () => {
    renderMeter({ riskProfileId: 'balanced' })
    expect(screen.getByText('Balanced')).toBeTruthy()
  })

  it('renders conservative badge', () => {
    renderMeter({ riskProfileId: 'conservative' })
    expect(screen.getByText('Conservative')).toBeTruthy()
  })

  it('renders aggressive badge', () => {
    renderMeter({ riskProfileId: 'aggressive' })
    expect(screen.getByText('Aggressive')).toBeTruthy()
  })

  it('does not render badge when riskProfileId is omitted', () => {
    renderMeter({ riskProfileId: undefined })
    expect(screen.queryByText('Conservative')).toBeNull()
    expect(screen.queryByText('Balanced')).toBeNull()
    expect(screen.queryByText('Aggressive')).toBeNull()
  })

  // Zone labels

  it('renders all three zone labels', () => {
    renderMeter()
    expect(screen.getByText('Safe')).toBeTruthy()
    expect(screen.getByText('Caution')).toBeTruthy()
    expect(screen.getByText('Danger')).toBeTruthy()
  })

  it('highlights the active zone label based on valuePercent', () => {
    renderMeter({ valuePercent: 10 })
    const safeLabel = screen.getByText('Safe')
    expect(safeLabel.getAttribute('aria-current')).toBe('true')
  })

  it('highlights caution zone for mid-range value', () => {
    renderMeter({ valuePercent: 50 })
    const cautionLabel = screen.getByText('Caution')
    expect(cautionLabel.getAttribute('aria-current')).toBe('true')
  })

  it('highlights danger zone for high value', () => {
    renderMeter({ valuePercent: 90 })
    const dangerLabel = screen.getByText('Danger')
    expect(dangerLabel.getAttribute('aria-current')).toBe('true')
  })

  // Annotation box

  it('shows annotation text for the active zone (safe)', () => {
    renderMeter({ valuePercent: 10 })
    expect(
      screen.getByText(/Low exposure.*conservative risk profile/i),
    ).toBeTruthy()
  })

  it('shows caution annotation for mid-range value', () => {
    renderMeter({ valuePercent: 50 })
    expect(
      screen.getByText(/Moderate exposure.*balanced risk profile/i),
    ).toBeTruthy()
  })

  it('shows danger annotation for high value', () => {
    renderMeter({ valuePercent: 90 })
    expect(
      screen.getByText(/High exposure.*aggressive risk profile/i),
    ).toBeTruthy()
  })

  // ARIA attributes

  it('meter element has role="meter"', () => {
    const { container } = renderMeter()
    const meter = container.querySelector('[role="meter"]')
    expect(meter).toBeTruthy()
  })

  it('meter has correct aria-valuenow', () => {
    const { container } = renderMeter({ valuePercent: 35 })
    const meter = container.querySelector('[role="meter"]')
    expect(meter?.getAttribute('aria-valuenow')).toBe('35')
  })

  it('meter has aria-valuemin and aria-valuemax', () => {
    const { container } = renderMeter()
    const meter = container.querySelector('[role="meter"]')
    expect(meter?.getAttribute('aria-valuemin')).toBe('0')
    expect(meter?.getAttribute('aria-valuemax')).toBe('100')
  })

  it('meter has aria-valuetext describing the zone', () => {
    const { container } = renderMeter({ valuePercent: 70 })
    const meter = container.querySelector('[role="meter"]')
    const valuetext = meter?.getAttribute('aria-valuetext') ?? ''
    expect(valuetext).toContain('70 percent')
    expect(valuetext).toContain('danger')
  })

  it('section has aria-labelledby pointing to the heading', () => {
    const { container } = renderMeter()
    const section = container.querySelector('section')
    const labelledby = section?.getAttribute('aria-labelledby') ?? ''
    expect(labelledby.length).toBeGreaterThan(0)
    const heading = document.getElementById(labelledby)
    expect(heading?.textContent).toBe('Volatility Exposure')
  })

  it('region has aria-describedby when description is provided', () => {
    const { container } = renderMeter({ description: 'Some desc' })
    const section = container.querySelector('section')
    const describedby = section?.getAttribute('aria-describedby') ?? ''
    expect(describedby.length).toBeGreaterThan(0)
    const descEl = document.getElementById(describedby)
    expect(descEl?.textContent).toBe('Some desc')
  })

  it('annotation box has role="status" and aria-live="polite"', () => {
    const { container } = renderMeter()
    const status = container.querySelector('[role="status"]')
    expect(status).toBeTruthy()
    expect(status?.getAttribute('aria-live')).toBe('polite')
  })

  it('labels row has role="list" with aria-label', () => {
    const { container } = renderMeter()
    const list = container.querySelector('[role="list"]')
    expect(list).toBeTruthy()
    expect(list?.getAttribute('aria-label')).toBe('Exposure threshold zones')
  })

  it('each zone label is a listitem', () => {
    const { container } = renderMeter()
    const items = container.querySelectorAll('[role="listitem"]')
    expect(items.length).toBe(3)
  })

  // Tooltip trigger

  it('renders a tooltip trigger with aria-label', () => {
    const { container } = renderMeter()
    const trigger = container.querySelector('[role="tooltip"]')
    expect(trigger).toBeTruthy()
    expect(trigger?.getAttribute('aria-label')).toBeTruthy()
  })

  // Meter aria-label

  it('meter has an aria-label describing exposure and range', () => {
    const { container } = renderMeter({ valuePercent: 25 })
    const meter = container.querySelector('[role="meter"]')
    const ariaLabel = meter?.getAttribute('aria-label') ?? ''
    expect(ariaLabel).toContain('Volatility exposure')
    expect(ariaLabel).toContain('25%')
    expect(ariaLabel).toContain('safe')
  })

  // Annotation icons

  it('renders annotation icons with aria-hidden', () => {
    const { container } = renderMeter({ valuePercent: 10 })
    const icons = container.querySelectorAll('[aria-hidden="true"]')
    // At least one icon for the annotation box, plus meter internals
    const annotationIcon = Array.from(icons).find(
      (el) => el.textContent === '✅',
    )
    expect(annotationIcon).toBeTruthy()
  })

  it('shows caution icon for mid-range value', () => {
    const { container } = renderMeter({ valuePercent: 50 })
    const icons = container.querySelectorAll('[aria-hidden="true"]')
    const cautionIcon = Array.from(icons).find(
      (el) => el.textContent?.includes('⚠'),
    )
    expect(cautionIcon).toBeTruthy()
  })

  it('shows danger icon for high value', () => {
    const { container } = renderMeter({ valuePercent: 90 })
    const icons = container.querySelectorAll('[aria-hidden="true"]')
    const dangerIcon = Array.from(icons).find(
      (el) => el.textContent === '❌',
    )
    expect(dangerIcon).toBeTruthy()
  })
})
