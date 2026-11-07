import { describe, expect, it } from 'vitest'
import { CITIES, SEED_RESTAURANTS } from '../../data/seed'
import type { WaitEstimate } from '../../data/types'
import { rankRestaurants } from '../discovery/rank'
import { childFromAge } from '../scoring/ageBands'
import { DEFAULT_BAIL_OUT_CONFIG, findBailOutOptions, type BailOutCandidate } from './findAlternative'

// Saturday 2026-11-07, 11:00 in Portland.
const NOW = new Date('2026-11-07T19:00:00Z')

const wait = (minutes: number): WaitEstimate => ({ minutes, level: minutes <= 10 ? 'short' : 'long', source: 'simulated', asOf: NOW.toISOString() })

function candidatesFrom(currentId: string, opts: { waits?: Record<string, number>; defaultWait?: number; kids?: ReturnType<typeof childFromAge>[] } = {}): BailOutCandidate[] {
  const current = SEED_RESTAURANTS.find((r) => r.id === currentId)
  if (!current) throw new Error('missing current')
  const ranked = rankRestaurants({
    restaurants: SEED_RESTAURANTS.filter((r) => r.cityId === current.cityId),
    children: opts.kids ?? [childFromAge('t', 2)],
    origin: current.location, // measured from where the family is sitting
    cities: CITIES,
    now: NOW,
    maxDistanceKm: null,
    sort: 'distance',
  })
  return ranked.map((item) => ({ item, wait: wait(opts.waits?.[item.restaurant.id] ?? opts.defaultWait ?? 5) }))
}

const ids = (r: ReturnType<typeof findBailOutOptions>) => r.picks.map((p) => p.candidate.item.restaurant.id)
const CURRENT = 'pdx-marlow-finch-bistro' // slow kitchen: the kind of place you want to leave

describe('findBailOutOptions', () => {
  it('never suggests the restaurant you are already in', () => {
    const result = findBailOutOptions({ currentId: 'pdx-little-fern-kitchen', candidates: candidatesFrom('pdx-little-fern-kitchen') })
    expect(ids(result)).not.toContain('pdx-little-fern-kitchen')
  })

  it('offers the nearest place that is open, fast, quick to seat, and a good fit', () => {
    const result = findBailOutOptions({ currentId: 'pdx-little-fern-kitchen', candidates: candidatesFrom('pdx-little-fern-kitchen') })
    expect(result.relaxed).toBe(false)
    const [first, ...rest] = result.picks
    expect(first?.fastKitchen).toBe(true)
    expect(first?.shortfalls).toEqual([])
    for (const pick of result.picks) {
      expect(pick.candidate.item.open).toBe(true)
      expect(['great', 'good']).toContain(pick.candidate.item.fit.level)
      expect(pick.candidate.wait?.minutes ?? 99).toBeLessThanOrEqual(DEFAULT_BAIL_OUT_CONFIG.maxWaitMinutes)
    }
    // Nearest first.
    const distances = [first, ...rest].map((p) => p?.candidate.item.distanceKm ?? 0)
    expect([...distances].sort((a, b) => a - b)).toEqual(distances)
  })

  it('measures "nearest" from the current restaurant, not from the city centre', () => {
    const fromSellwood = candidatesFrom('pdx-birch-hollow-brewpub') // far south-east of the centre
    const first = fromSellwood.find((c) => c.item.restaurant.id !== 'pdx-birch-hollow-brewpub')
    expect(first?.item.distanceKm).toBeLessThan(10)
    const nearest = findBailOutOptions({ currentId: 'pdx-birch-hollow-brewpub', candidates: fromSellwood }).picks[0]
    expect(nearest?.candidate.item.distanceKm).toBeLessThan(6)
  })

  it('skips places with a long wait, then offers the next nearest', () => {
    const baseline = findBailOutOptions({ currentId: CURRENT, candidates: candidatesFrom(CURRENT) })
    const firstId = ids(baseline)[0] ?? ''
    const slowed = findBailOutOptions({ currentId: CURRENT, candidates: candidatesFrom(CURRENT, { waits: { [firstId]: 35 } }) })
    expect(ids(slowed)).not.toContain(firstId)
    expect(slowed.relaxed).toBe(false)
  })

  it('falls back to the nearest decent places when nothing is quick, and says why', () => {
    const result = findBailOutOptions({ currentId: CURRENT, candidates: candidatesFrom(CURRENT, { defaultWait: 40 }) })
    expect(result.relaxed).toBe(true)
    expect(result.picks.length).toBeGreaterThan(0)
    for (const pick of result.picks) {
      expect(pick.shortfalls).toContain('wait')
      expect(pick.candidate.item.fit.level).not.toBe('poor')
    }
  })

  it('returns nothing when no other place is open', () => {
    const closed = candidatesFrom(CURRENT).map((c) => ({ ...c, item: { ...c.item, open: false } }))
    expect(findBailOutOptions({ currentId: CURRENT, candidates: closed }).picks).toEqual([])
  })

  it('fits the whole family, not just one child', () => {
    const family = [childFromAge('b', 0), childFromAge('t', 2)]
    const result = findBailOutOptions({ currentId: CURRENT, candidates: candidatesFrom(CURRENT, { kids: family }) })
    for (const pick of result.picks) expect(pick.candidate.item.fit.perChild).toHaveLength(2)
  })
})
