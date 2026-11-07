import { describe, expect, it } from 'vitest'
import type { OpeningPeriod } from '../../data/types'
import { activeKidWindow, isOpenAt, minutesUntilClose } from './hours'
import { formatClock, localParts, parseClock } from './localTime'

const PT = 'America/Los_Angeles'
const CT = 'America/Chicago'

// 2026-11-07 is a Saturday; US daylight time ended 2026-11-01, so PST = UTC-8 and CST = UTC-6.
const sat11amPT = new Date('2026-11-07T19:00:00Z')

describe('localParts', () => {
  it('reads the weekday and time in the restaurant’s own time zone', () => {
    expect(localParts(sat11amPT, PT)).toEqual({ weekday: 'sat', minutes: 11 * 60 })
    expect(localParts(sat11amPT, CT)).toEqual({ weekday: 'sat', minutes: 13 * 60 })
  })

  it('rolls the weekday over midnight correctly', () => {
    // 02:00 UTC Sunday is still Saturday evening in Portland.
    expect(localParts(new Date('2026-11-08T04:00:00Z'), PT)).toEqual({ weekday: 'sat', minutes: 20 * 60 })
  })
})

describe('clock helpers', () => {
  it('parses and formats HH:MM', () => {
    expect(parseClock('17:30')).toBe(1050)
    expect(formatClock('17:30')).toBe('5:30 pm')
    expect(formatClock('09:00')).toBe('9 am')
    expect(formatClock('00:00')).toBe('12 am')
    expect(formatClock('12:00')).toBe('12 pm')
  })

  it('rejects malformed times', () => {
    expect(() => parseClock('5pm')).toThrow()
    expect(() => parseClock('12:75')).toThrow()
  })
})

describe('isOpenAt', () => {
  const daytime: OpeningPeriod[] = [{ days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], open: '08:00', close: '15:00' }]

  it('is open inside the period and closed outside, with an exclusive close', () => {
    expect(isOpenAt(daytime, PT, sat11amPT)).toBe(true)
    expect(isOpenAt(daytime, PT, new Date('2026-11-07T23:00:00Z'))).toBe(false) // exactly 15:00 local
    expect(isOpenAt(daytime, PT, new Date('2026-11-07T22:59:00Z'))).toBe(true) // 14:59 local
    expect(isOpenAt(daytime, PT, new Date('2026-11-07T15:00:00Z'))).toBe(false) // 07:00 local
  })

  it('respects the days a period applies to', () => {
    const weekdaysOnly: OpeningPeriod[] = [{ days: ['mon', 'tue', 'wed', 'thu', 'fri'], open: '08:00', close: '15:00' }]
    expect(isOpenAt(weekdaysOnly, PT, sat11amPT)).toBe(false)
  })

  it('handles periods that run past midnight', () => {
    const lateFriday: OpeningPeriod[] = [{ days: ['fri'], open: '20:00', close: '01:00' }]
    expect(isOpenAt(lateFriday, CT, new Date('2026-11-07T04:00:00Z'))).toBe(true) // Fri 22:00 CST
    expect(isOpenAt(lateFriday, CT, new Date('2026-11-07T06:30:00Z'))).toBe(true) // Sat 00:30 CST
    expect(isOpenAt(lateFriday, CT, new Date('2026-11-07T07:30:00Z'))).toBe(false) // Sat 01:30 CST
    expect(isOpenAt(lateFriday, CT, new Date('2026-11-07T20:00:00Z'))).toBe(false) // Sat 14:00 CST
  })

  it('treats a midnight close as ending the day', () => {
    const toMidnight: OpeningPeriod[] = [{ days: ['sat'], open: '16:00', close: '00:00' }]
    expect(isOpenAt(toMidnight, CT, new Date('2026-11-08T05:30:00Z'))).toBe(true) // Sat 23:30 CST
    expect(isOpenAt(toMidnight, CT, new Date('2026-11-08T06:30:00Z'))).toBe(false) // Sun 00:30 CST
  })
})

describe('minutesUntilClose and kid windows', () => {
  const hours: OpeningPeriod[] = [{ days: ['sat'], open: '08:00', close: '15:00' }]

  it('counts down to closing time, or null when closed', () => {
    expect(minutesUntilClose(hours, PT, sat11amPT)).toBe(4 * 60)
    expect(minutesUntilClose(hours, PT, new Date('2026-11-07T01:00:00Z'))).toBeNull()
  })

  it('finds the active kid-friendly window', () => {
    const windows = [{ days: ['sat'] as const, start: '10:30', end: '12:00', note: 'Quietest' }]
    expect(activeKidWindow(windows, PT, sat11amPT)?.note).toBe('Quietest')
    expect(activeKidWindow(windows, PT, new Date('2026-11-07T21:00:00Z'))).toBeNull() // 13:00 local
  })
})
