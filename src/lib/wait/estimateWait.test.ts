import { describe, expect, it } from 'vitest'
import type { WaitProfile } from '../../data/types'
import { estimateWait, waitLevel } from './estimateWait'

const PT = 'America/Los_Angeles'
const profile: WaitProfile = {
  baseMinutes: 10,
  peaks: [{ days: ['sat'], start: '11:00', end: '13:00', extraMinutes: 30 }],
}

const sat11amPT = new Date('2026-11-07T19:00:00Z') // inside the peak
const sat2pmPT = new Date('2026-11-07T22:00:00Z') // after the peak

describe('estimateWait (simulated)', () => {
  it('is labelled simulated and stamped with the time asked about', () => {
    const wait = estimateWait(profile, PT, sat11amPT, 'r1')
    expect(wait.source).toBe('simulated')
    expect(wait.asOf).toBe(sat11amPT.toISOString())
  })

  it('is deterministic for the same restaurant and time', () => {
    expect(estimateWait(profile, PT, sat11amPT, 'r1')).toEqual(estimateWait(profile, PT, sat11amPT, 'r1'))
  })

  it('is longer inside a peak than outside it', () => {
    const peak = estimateWait(profile, PT, sat11amPT, 'r1')
    const quiet = estimateWait(profile, PT, sat2pmPT, 'r1')
    expect(peak.minutes).toBeGreaterThan(quiet.minutes)
  })

  it('rounds to 5 minutes and never goes below zero', () => {
    for (const key of ['a', 'b', 'c', 'd', 'e']) {
      const wait = estimateWait({ baseMinutes: 0, peaks: [] }, PT, sat11amPT, key)
      expect(wait.minutes % 5).toBe(0)
      expect(wait.minutes).toBeGreaterThanOrEqual(0)
    }
  })

  it('stays within ±15% of the model before rounding', () => {
    const wait = estimateWait(profile, PT, sat11amPT, 'r1')
    const model = 40
    expect(wait.minutes).toBeGreaterThanOrEqual(Math.floor((model * 0.85) / 5) * 5)
    expect(wait.minutes).toBeLessThanOrEqual(Math.ceil((model * 1.15) / 5) * 5)
  })
})

describe('waitLevel', () => {
  it.each([
    [0, 'short'],
    [10, 'short'],
    [15, 'moderate'],
    [20, 'moderate'],
    [25, 'long'],
  ] as const)('%i minutes is %s', (minutes, level) => {
    expect(waitLevel(minutes)).toBe(level)
  })
})
