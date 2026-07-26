import { describe, expect, it } from 'vitest'
import { faqEntries, searchFaqEntries } from '@/lib/faq'

describe('searchFaqEntries', () => {
  it('returns all entries for an empty query', () => {
    const results = searchFaqEntries('')
    expect(results).toEqual(faqEntries)
    expect(results).toHaveLength(faqEntries.length)
  })

  it('returns all entries for a whitespace-only query', () => {
    const results = searchFaqEntries('   ')
    expect(results).toEqual(faqEntries)
    expect(results).toHaveLength(faqEntries.length)
  })

  it('returns entries matching a tag', () => {
    const results = searchFaqEntries('discord')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('support')
  })

  it('returns an empty array when no entries match', () => {
    const results = searchFaqEntries('xyznonexistent123')
    expect(results).toEqual([])
  })

  it('is case-insensitive', () => {
    const lower = searchFaqEntries('connect')
    const upper = searchFaqEntries('CONNECT')
    const mixed = searchFaqEntries('CoNnEcT')
    expect(lower).toHaveLength(1)
    expect(lower[0].id).toBe('wallet')
    expect(upper).toEqual(lower)
    expect(mixed).toEqual(lower)
  })

  it('matches across question, answer, and tags', () => {
    // 'transparent' appears in the answer of the commitments entry
    const byAnswer = searchFaqEntries('transparent')
    expect(byAnswer).toHaveLength(1)
    expect(byAnswer[0].id).toBe('commitments')

    // 'resolution' appears in the tags of the disputes entry
    const byTag = searchFaqEntries('resolution')
    expect(byTag).toHaveLength(1)
    expect(byTag[0].id).toBe('disputes')

    // 'commitments' appears in the question of the commitments entry
    const byQuestion = searchFaqEntries('how do commitments')
    expect(byQuestion).toHaveLength(1)
    expect(byQuestion[0].id).toBe('commitments')
  })
})
