// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest'

/**
 * Example tests demonstrating the patterns documented in docs/TESTING_GUIDE.md.
 * These tests serve as copy-paste templates and are validated by CI.
 */

describe('Testing Guide Examples', () => {
  describe('mocking fetch', () => {
    it('mocks a successful JSON response', async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'test-value' }),
      })
      global.fetch = mockFetch

      const res = await fetch('/api/test')
      const data = await res.json()

      expect(data.data).toBe('test-value')
      expect(mockFetch).toHaveBeenCalledWith('/api/test')
    })
  })

  describe('mocking timers', () => {
    it('uses fake timers to control time', () => {
      vi.useFakeTimers()
      const callback = vi.fn()

      setTimeout(callback, 1000)
      expect(callback).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1000)
      expect(callback).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })
  })

  describe('basic assertions', () => {
    it('demonstrates common assertion patterns', () => {
      expect(true).toBe(true)
      expect([1, 2, 3]).toHaveLength(3)
      expect({ name: 'test' }).toEqual({ name: 'test' })
      expect('hello world').toContain('world')
    })
  })
})
