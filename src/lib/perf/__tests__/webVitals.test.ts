import { describe, it, expect, afterEach } from 'vitest'
import {
  reportWebVital,
  setWebVitalsSink,
  isWithinBudget,
  WEB_VITALS_BUDGET,
  type WebVitalRecord,
} from '../webVitals'

afterEach(() => {
  setWebVitalsSink() // reset to the no-op default
})

describe('webVitals reporter', () => {
  it('is a no-op by default (no sink, no throw)', () => {
    expect(() =>
      reportWebVital({ name: 'LCP', value: 1200, id: 'v1' }),
    ).not.toThrow()
  })

  it('forwards a sanitized record to a registered sink', () => {
    const captured: WebVitalRecord[] = []
    setWebVitalsSink((r) => captured.push(r))

    reportWebVital({
      name: 'LCP',
      value: 1800.4,
      rating: 'good',
      id: 'metric-1',
      navigationType: 'navigate',
    })

    expect(captured).toHaveLength(1)
    expect(captured[0]).toEqual({
      name: 'LCP',
      value: 1800.4,
      rating: 'good',
      id: 'metric-1',
      navigationType: 'navigate',
    })
  })

  it('drops unknown metric names and non-finite values', () => {
    const captured: WebVitalRecord[] = []
    setWebVitalsSink((r) => captured.push(r))

    reportWebVital({ name: 'NOT_A_METRIC', value: 1 })
    reportWebVital({ name: 'CLS', value: Number.NaN })
    reportWebVital({ name: 'LCP', value: Infinity })

    expect(captured).toHaveLength(0)
  })

  it('does not forward PII-like extra fields from the raw metric', () => {
    const captured: WebVitalRecord[] = []
    setWebVitalsSink((r) => captured.push(r))

    // Simulate a raw metric carrying extra fields (entries/attribution/etc.)
    reportWebVital({
      name: 'INP',
      value: 90,
      id: 'x',
      // @ts-expect-error — extra fields must be ignored, not forwarded
      entries: [{ name: 'click', target: 'button#secret' }],
      attribution: { element: 'div.user-data' },
    })

    expect(captured).toHaveLength(1)
    expect(Object.keys(captured[0]).sort()).toEqual(['id', 'name', 'value'])
    expect('entries' in captured[0]).toBe(false)
    expect('attribution' in captured[0]).toBe(false)
  })

  it('never throws even if the sink throws', () => {
    setWebVitalsSink(() => {
      throw new Error('sink boom')
    })
    expect(() => reportWebVital({ name: 'CLS', value: 0.05 })).not.toThrow()
  })

  it('evaluates values against the documented budget', () => {
    expect(isWithinBudget('LCP', WEB_VITALS_BUDGET.LCP)).toBe(true)
    expect(isWithinBudget('LCP', WEB_VITALS_BUDGET.LCP + 1)).toBe(false)
    expect(isWithinBudget('CLS', 0.05)).toBe(true)
    expect(isWithinBudget('CLS', 0.2)).toBe(false)
    // Metrics without a budget are treated as within budget.
    expect(isWithinBudget('TTFB', 99999)).toBe(true)
  })
})
