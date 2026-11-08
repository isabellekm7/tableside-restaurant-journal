import { describe, expect, it } from 'vitest'
import type { ParentFeedback } from '../../data/types'
import { blendSignals } from './blend'
import { REQUIRED_QUESTIONS, WAIT_CHOICES, answeredCount, bandsFromChildren, emptyDraft, isComplete, toNewFeedback, toggleBand, type FeedbackDraft } from './form'

const complete: FeedbackDraft = {
  bands: ['toddler', 'preschool'],
  hadHighChair: 'yes',
  staffWelcoming: 'somewhat',
  waitMinutes: 10,
  noise: 'loud',
  wouldReturn: true,
  notForUs: false,
}

describe('feedback form', () => {
  it('counts answers and knows when it is complete', () => {
    expect(answeredCount(emptyDraft())).toBe(0)
    expect(answeredCount(emptyDraft(['toddler']))).toBe(1)
    expect(answeredCount(complete)).toBe(REQUIRED_QUESTIONS)
    expect(isComplete(complete)).toBe(true)
    expect(isComplete({ ...complete, noise: null })).toBe(false)
    expect(isComplete({ ...complete, bands: [] })).toBe(false)
  })

  it('treats "Not for us" as optional', () => {
    expect(isComplete({ ...complete, notForUs: false })).toBe(true)
    expect(answeredCount({ ...complete, notForUs: true })).toBe(REQUIRED_QUESTIONS)
  })

  it('treats "no wait" (0 minutes) as an answer, not as missing', () => {
    expect(isComplete({ ...complete, waitMinutes: 0 })).toBe(true)
  })

  it('only produces a report when everything is answered, tagged with the age bands', () => {
    expect(toNewFeedback('r1', { ...complete, wouldReturn: null })).toBeNull()
    expect(toNewFeedback('r1', complete)).toEqual({
      restaurantId: 'r1', reporterBands: ['toddler', 'preschool'], hadHighChair: 'yes', staffWelcoming: 'somewhat',
      waitMinutes: 10, noise: 'loud', wouldReturn: true, notForUs: false,
    })
  })

  it('keeps bands in a stable order whatever order they were tapped', () => {
    expect(toNewFeedback('r1', { ...complete, bands: ['schoolAge', 'infant'] })?.reporterBands).toEqual(['infant', 'schoolAge'])
    expect(toggleBand(['schoolAge'], 'infant')).toEqual(['infant', 'schoolAge'])
    expect(toggleBand(['infant', 'schoolAge'], 'infant')).toEqual(['schoolAge'])
  })

  it('pre-fills bands from the family profile, without duplicates', () => {
    expect(bandsFromChildren([{ band: 'toddler' }, { band: 'infant' }, { band: 'toddler' }])).toEqual(['infant', 'toddler'])
    expect(bandsFromChildren([])).toEqual([])
  })

  it('offers wait choices from none to 30+ minutes', () => {
    expect(WAIT_CHOICES.map((w) => w.value)).toEqual([0, 5, 10, 20, 35])
  })
})

describe('blendSignals', () => {
  const base = { reportCount: 14, wouldReturnCount: 9, notForUsCount: 1 }
  const report = (over: Partial<ParentFeedback> = {}): ParentFeedback => ({
    id: 'f', restaurantId: 'r1', createdAt: '2026-11-07T00:00:00Z', reporterBands: ['toddler'], hadHighChair: 'yes',
    staffWelcoming: 'yes', waitMinutes: 5, noise: 'quiet', wouldReturn: true, notForUs: false, ...over,
  })

  it('leaves everyone else’s numbers alone when you have not reported', () => {
    expect(blendSignals(base, [])).toEqual({ signals: base, includesYours: false })
  })

  it('adds your own reports, and says so', () => {
    expect(blendSignals(base, [report(), report({ wouldReturn: false, notForUs: true })])).toEqual({
      signals: { reportCount: 16, wouldReturnCount: 10, notForUsCount: 2 },
      includesYours: true,
    })
  })

  it('does not change the catalog numbers it was given', () => {
    const before = JSON.stringify(base)
    blendSignals(base, [report()])
    expect(JSON.stringify(base)).toBe(before)
  })
})
