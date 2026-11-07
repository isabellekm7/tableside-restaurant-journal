import { describe, expect, it } from 'vitest'
import { CITIES, SEED_RESTAURANTS } from '../../data/seed'
import { childFromAge } from '../scoring/ageBands'
import { formatDistance, formatTravel, kmToMiles, milesToKm, nearestCity } from '../geo/format'
import { resolveCity } from './cities'
import { DEFAULT_FILTERS, activeFilterCount, maxDistanceKm, toRepositoryQuery } from './filters'
import { closestCompromises, hasGoodFit, rankRestaurants, type RankInput } from './rank'

// Saturday 2026-11-07, 11:00 in Portland (PST) and 13:00 in Chicago (CST).
const SATURDAY_MIDDAY = new Date('2026-11-07T19:00:00Z')
const portland = CITIES.find((c) => c.id === 'portland')
if (!portland) throw new Error('missing city')
const portlandRestaurants = SEED_RESTAURANTS.filter((r) => r.cityId === 'portland')

const base: RankInput = {
  restaurants: portlandRestaurants,
  children: [childFromAge('t', 2)],
  origin: portland.center,
  cities: CITIES,
  now: SATURDAY_MIDDAY,
  maxDistanceKm: null,
  sort: 'fit',
}

const byId = (items: ReturnType<typeof rankRestaurants>, id: string) => items.find((i) => i.restaurant.id === id)

describe('rankRestaurants', () => {
  const ranked = rankRestaurants(base)

  it('ranks every restaurant, with open places before closed ones', () => {
    expect(ranked).toHaveLength(portlandRestaurants.length)
    const firstClosed = ranked.findIndex((i) => !i.open)
    expect(firstClosed).toBeGreaterThan(0)
    expect(ranked.slice(firstClosed).every((i) => !i.open)).toBe(true)
  })

  it('orders by fit score within open places, with "not enough info" last', () => {
    const open = ranked.filter((i) => i.open)
    const known = open.filter((i) => i.fit.level !== 'unknown')
    for (let i = 1; i < known.length; i++) {
      expect(known[i - 1]?.fit.score ?? 0).toBeGreaterThanOrEqual(known[i]?.fit.score ?? 0)
    }
    const firstUnknown = open.findIndex((i) => i.fit.level === 'unknown')
    if (firstUnknown >= 0) expect(open.slice(firstUnknown).every((i) => i.fit.level === 'unknown')).toBe(true)
  })

  it('reports open status in each restaurant’s own time zone', () => {
    const fern = byId(ranked, 'pdx-little-fern-kitchen') // 08:00-15:00 daily
    expect(fern?.open).toBe(true)
    expect(fern?.closesAt).toBe('15:00')
    expect(fern?.minutesUntilClose).toBe(240)
    expect(byId(ranked, 'pdx-velvet-ladle')?.open).toBe(false) // Wed-Sat evenings only
  })

  it('computes distance and travel from the chosen origin', () => {
    const marlow = byId(ranked, 'pdx-marlow-finch-bistro')
    expect(marlow?.distanceKm).toBeGreaterThan(0.5)
    expect(marlow?.distanceKm).toBeLessThan(1.2)
    expect(marlow?.travel.mode).toBe('walk')
    const elsewhere = rankRestaurants({ ...base, origin: { lat: 45.4645, lng: -122.6531 } }) // Sellwood
    expect(byId(elsewhere, 'pdx-birch-hollow-brewpub')?.distanceKm).toBeLessThan(0.2)
  })

  it('sorts nearest first on request', () => {
    const nearest = rankRestaurants({ ...base, sort: 'distance' })
    const distances = nearest.map((i) => i.distanceKm)
    expect([...distances].sort((a, b) => a - b)).toEqual(distances)
  })

  it('drops places beyond the distance limit', () => {
    const near = rankRestaurants({ ...base, maxDistanceKm: 3 })
    expect(near.length).toBeLessThan(ranked.length)
    expect(near.every((i) => i.distanceKm <= 3)).toBe(true)
  })

  it('re-ranks when the kids change: the same place can win for a toddler and lose for a baby', () => {
    const toddlerFern = byId(ranked, 'pdx-little-fern-kitchen')
    const babyFern = byId(rankRestaurants({ ...base, children: [childFromAge('b', 0)] }), 'pdx-little-fern-kitchen')
    expect(toddlerFern?.fit.level).toBe('great')
    expect(babyFern?.fit.level).toBe('poor')
  })

  it('does not mutate its inputs', () => {
    const before = JSON.stringify(base.restaurants)
    rankRestaurants(base)
    expect(JSON.stringify(base.restaurants)).toBe(before)
  })
})

describe('compromises', () => {
  it('detects when nothing is a good fit', () => {
    const poorOnly = rankRestaurants({ ...base, restaurants: portlandRestaurants.filter((r) => r.id === 'pdx-velvet-ladle') })
    expect(hasGoodFit(poorOnly)).toBe(false)
    expect(hasGoodFit(rankRestaurants(base))).toBe(true)
  })

  it('offers the best few options, best first', () => {
    const picks = closestCompromises(rankRestaurants(base), 3)
    expect(picks).toHaveLength(3)
    expect(picks[0]?.fit.score ?? 0).toBeGreaterThanOrEqual(picks[2]?.fit.score ?? 0)
  })
})

describe('filters', () => {
  const now = SATURDAY_MIDDAY

  it('counts only active filters', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0)
    expect(
      activeFilterCount({ openNow: true, maxPrice: 2, maxDistanceMiles: 1, cuisines: ['Ramen', 'Pizza'], dietary: ['vegan'] }),
    ).toBe(6)
  })

  it('builds a minimal repository query', () => {
    expect(toRepositoryQuery({ cityId: 'portland', search: '  ', filters: DEFAULT_FILTERS, now })).toEqual({ cityId: 'portland' })
    expect(
      toRepositoryQuery({
        cityId: 'chicago',
        search: ' ramen ',
        filters: { ...DEFAULT_FILTERS, openNow: true, maxPrice: 2, cuisines: ['Ramen'], dietary: ['vegan'] },
        now,
      }),
    ).toEqual({ cityId: 'chicago', text: 'ramen', maxPriceLevel: 2, cuisines: ['Ramen'], dietary: ['vegan'], openAt: now })
  })

  it('converts the distance limit to kilometres', () => {
    expect(maxDistanceKm(DEFAULT_FILTERS)).toBeNull()
    expect(maxDistanceKm({ ...DEFAULT_FILTERS, maxDistanceMiles: 1 })).toBeCloseTo(1.609, 2)
  })
})

describe('resolveCity', () => {
  it.each([
    ['Portland, OR', 'portland'],
    ['portland', 'portland'],
    ['chi', 'chicago'],
    ['  Chicago ', 'chicago'],
    ['CHICAGO, il', 'chicago'],
  ])('matches "%s"', (text, id) => {
    expect(resolveCity(text, CITIES)?.id).toBe(id)
  })

  it.each(['', 'p0rtland', 'Austin', ', OR'])('returns null for "%s"', (text) => {
    expect(resolveCity(text, CITIES)).toBeNull()
  })

  it('accepts a one-letter prefix when only one city starts with it', () => {
    expect(resolveCity('c', CITIES)?.id).toBe('chicago')
  })

  it('refuses ambiguous prefixes', () => {
    const chicago = CITIES.find((c) => c.id === 'chicago')
    if (!chicago) throw new Error('missing city')
    const charlotte = { ...chicago, name: 'Charlotte' }
    expect(resolveCity('ch', [chicago, charlotte])).toBeNull()
  })
})

describe('geo formatting', () => {
  it('formats distances in miles', () => {
    expect(formatDistance(0.05)).toBe('Nearby')
    expect(formatDistance(milesToKm(0.4))).toBe('0.4 mi')
    expect(formatDistance(milesToKm(12.4))).toBe('12 mi')
    expect(kmToMiles(milesToKm(3))).toBeCloseTo(3, 6)
  })

  it('formats travel time', () => {
    expect(formatTravel({ mode: 'walk', minutes: 9 })).toBe('9 min walk')
    expect(formatTravel({ mode: 'ride', minutes: 14 })).toBe('14 min ride')
  })

  it('finds the nearest supported city, or null when far from all', () => {
    expect(nearestCity({ lat: 45.6387, lng: -122.6615 }, CITIES)?.id).toBe('portland') // Vancouver, WA
    expect(nearestCity({ lat: 41.9, lng: -87.7 }, CITIES)?.id).toBe('chicago')
    expect(nearestCity({ lat: 30.27, lng: -97.74 }, CITIES)).toBeNull() // Austin
  })
})
