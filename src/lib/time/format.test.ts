import { describe, expect, it } from 'vitest'
import type { Weekday } from '../../data/types'
import { describeConfirmed, formatDays, formatTimeRange } from './format'

describe('formatDays', () => {
  it.each<[Weekday[], string]>([
    [['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], 'Every day'],
    [['mon', 'tue', 'wed', 'thu', 'fri'], 'Weekdays'],
    [['sat', 'sun'], 'Weekends'],
    [['tue', 'wed', 'thu', 'fri', 'sat', 'sun'], 'Tue–Sun'],
    [['wed', 'thu', 'fri', 'sat'], 'Wed–Sat'],
    [['thu', 'fri', 'sat'], 'Thu–Sat'],
    [['wed', 'fri', 'sat', 'sun'], 'Wed, Fri–Sun'],
    [['mon', 'tue'], 'Mon, Tue'],
    [['sun'], 'Sun'],
  ])('%j → %s', (days, expected) => {
    expect(formatDays(days)).toBe(expected)
  })

  it('does not care about input order', () => {
    expect(formatDays(['sun', 'sat'])).toBe('Weekends')
    expect(formatDays(['fri', 'mon', 'thu', 'wed', 'tue'])).toBe('Weekdays')
  })
})

describe('formatTimeRange', () => {
  it.each([
    ['08:00', '09:30', '8–9:30 am'],
    ['17:00', '18:30', '5–6:30 pm'],
    ['11:30', '13:00', '11:30 am – 1 pm'],
    ['00:00', '01:00', '12–1 am'],
    ['12:00', '15:00', '12–3 pm'],
  ])('%s to %s → %s', (start, end, expected) => {
    expect(formatTimeRange(start, end)).toBe(expected)
  })
})

describe('describeConfirmed', () => {
  const now = new Date('2026-11-07T19:00:00Z')

  it('words recency plainly', () => {
    expect(describeConfirmed('2026-11-07', now)).toMatchObject({ label: 'Nov 7, 2026', ago: 'today', stale: false })
    expect(describeConfirmed('2026-11-06', now).ago).toBe('yesterday')
    expect(describeConfirmed('2026-10-11', now)).toMatchObject({ label: 'Oct 11, 2026', ago: '27 days ago', stale: false })
  })

  it('flags old reports as worth double-checking', () => {
    const old = describeConfirmed('2026-07-30', now)
    expect(old.ago).toBe('3 months ago')
    expect(old.stale).toBe(true)
  })

  it('never reports a future date as negative', () => {
    expect(describeConfirmed('2027-01-01', now).ago).toBe('today')
  })

  it('degrades gracefully on a malformed date', () => {
    expect(describeConfirmed('last week', now)).toEqual({ label: 'last week', ago: '', stale: false })
  })
})
