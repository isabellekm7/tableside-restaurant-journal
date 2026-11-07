import { describe, expect, it } from 'vitest'
import { CITIES, SEED_RESTAURANTS } from '../../data/seed'
import type { WaitEstimate } from '../../data/types'
import { rankRestaurants } from '../discovery/rank'
import { childFromAge } from '../scoring/ageBands'
import { DEFAULT_RIGHT_NOW_CONFIG, recommendRightNow, type RightNowCandidate } from './recommend'

// Saturday 2026-11-07, 11:00 in Portland.
const NOW = new Date('2026-11-07T19:00:00Z')
// Irvington: central enough that several places are within a short trip (the city centre is not).
const ORIGIN = { lat: 45.5412, lng: -122.6498 }

const wait = (minutes: number): WaitEstimate => ({
  minutes,
  level: minutes <= 10 ? 'short' : minutes <= 20 ? 'moderate' : 'long',
  source: 'simulated',
  asOf: NOW.toISOString(),
})

function candidates(opts: { waits?: Record<string, number>; defaultWait?: number; children?: ReturnType<typeof childFromAge>[]; now?: Date } = {}): RightNowCandidate[] {
  const ranked = rankRestaurants({
    restaurants: SEED_RESTAURANTS.filter((r) => r.cityId === 'portland'),
    children: opts.children ?? [childFromAge('t', 2)],
    origin: ORIGIN,
    cities: CITIES,
    now: opts.now ?? NOW,
    maxDistanceKm: null,
    sort: 'fit',
  })
  return ranked.map((item) => ({ item, wait: wait(opts.waits?.[item.restaurant.id] ?? opts.defaultWait ?? 5) }))
}

const ids = (result: ReturnType<typeof recommendRightNow>) => result.picks.map((p) => p.candidate.item.restaurant.id)

describe('recommendRightNow: strict', () => {
  it('only offers places that are open, close, quick, and a good fit', () => {
    const result = recommendRightNow(candidates())
    expect(result.relaxed).toBe(false)
    expect(result.picks.length).toBeGreaterThan(0)
    expect(result.picks.length).toBeLessThanOrEqual(DEFAULT_RIGHT_NOW_CONFIG.maxPicks)
    for (const { candidate, shortfalls } of result.picks) {
      expect(shortfalls).toEqual([])
      expect(candidate.item.open).toBe(true)
      expect(['great', 'good']).toContain(candidate.item.fit.level)
      expect(candidate.wait?.minutes ?? 99).toBeLessThanOrEqual(DEFAULT_RIGHT_NOW_CONFIG.maxWaitMinutes)
      expect(candidate.item.travel.minutes).toBeLessThanOrEqual(DEFAULT_RIGHT_NOW_CONFIG.maxTravelMinutes)
    }
  })

  it('never offers a closed place, however good the fit', () => {
    // The Velvet Ladle and Marlow & Finch are closed at 11 am Saturday.
    expect(ids(recommendRightNow(candidates()))).not.toContain('pdx-marlow-finch-bistro')
  })

  it('penalises waiting: a slightly weaker fit with no wait can beat a great fit with a long one', () => {
    const base = ids(recommendRightNow(candidates({ defaultWait: 5 })))
    const first = base[0]
    expect(first).toBeDefined()
    const slowed = ids(recommendRightNow(candidates({ defaultWait: 5, waits: { [first ?? '']: 14 } })))
    expect(slowed.indexOf(first ?? '')).toBeGreaterThan(base.indexOf(first ?? ''))
  })

  it('drops places whose wait exceeds the limit', () => {
    const everything = candidates({ defaultWait: 5 })
    const strictIds = ids(recommendRightNow(everything))
    const longWaits = Object.fromEntries(strictIds.map((id) => [id, 40]))
    const result = recommendRightNow(candidates({ defaultWait: 5, waits: longWaits }))
    for (const id of strictIds) expect(ids(result)).not.toContain(id)
  })

  it('ranks by kid-fit for the selected children', () => {
    const toddlerPicks = ids(recommendRightNow(candidates({ children: [childFromAge('t', 2)] })))
    const babyPicks = ids(recommendRightNow(candidates({ children: [childFromAge('b', 0)] })))
    expect(toddlerPicks).not.toEqual(babyPicks)
    expect(toddlerPicks).toContain('pdx-little-fern-kitchen') // a toddler place
    expect(babyPicks).not.toContain('pdx-little-fern-kitchen') // no changing table
  })

  it('does not offer places about to close', () => {
    // Ten minutes before Greenhouse Cafe (08-16) closes.
    const nearClose = recommendRightNow(candidates({ now: new Date('2026-11-07T23:50:00Z') }))
    for (const { candidate } of nearClose.picks) expect(candidate.item.minutesUntilClose ?? 999).toBeGreaterThanOrEqual(nearClose.relaxed ? 20 : 45)
  })
})

describe('recommendRightNow: relaxed', () => {
  it('falls back to the closest compromises, saying exactly where each falls short', () => {
    const result = recommendRightNow(candidates({ defaultWait: 40 }))
    expect(result.relaxed).toBe(true)
    expect(result.picks.length).toBeGreaterThan(0)
    for (const pick of result.picks) {
      expect(pick.shortfalls).toContain('wait')
      expect(pick.candidate.item.fit.level).not.toBe('poor')
    }
  })

  it('treats an unknown wait as a shortfall', () => {
    const unknown = candidates().map((c) => ({ ...c, wait: null }))
    const result = recommendRightNow(unknown)
    expect(result.relaxed).toBe(true)
    expect(result.picks[0]?.shortfalls).toContain('wait')
  })

  it('returns nothing, and says nothing is open, in the middle of the night', () => {
    const result = recommendRightNow(candidates({ now: new Date('2026-11-07T11:00:00Z') })) // 3 am Portland
    expect(result.openCount).toBe(0)
    expect(result.picks).toEqual([])
  })
})

describe('recommendRightNow: config', () => {
  it('is tunable without code changes', () => {
    const strictest = recommendRightNow(candidates({ defaultWait: 12 }), { ...DEFAULT_RIGHT_NOW_CONFIG, maxWaitMinutes: 10 })
    expect(strictest.relaxed).toBe(true)
    expect(recommendRightNow(candidates({ defaultWait: 12 })).relaxed).toBe(false)
  })
})
