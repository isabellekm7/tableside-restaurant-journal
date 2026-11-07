import { describe, expect, it } from 'vitest'
import { haversineKm } from '../../lib/geo/distance'
import { childFromAge } from '../../lib/scoring/ageBands'
import { scoreRestaurant } from '../../lib/scoring/score'
import { parseClock } from '../../lib/time/localTime'
import { ATTR_KEYS } from '../attributes'
import { WEEKDAYS, type Restaurant } from '../types'
import { CITIES, SEED_RESTAURANTS } from '.'

const TODAY = '2026-11-07'
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const byId = (id: string): Restaurant => {
  const found = SEED_RESTAURANTS.find((r) => r.id === id)
  if (!found) throw new Error(`Missing seed restaurant ${id}`)
  return found
}

const infant = childFromAge('infant', 0)
const toddler = childFromAge('toddler', 2)
const preschooler = childFromAge('preschooler', 4)
const schoolKid = childFromAge('school', 8)
const allBands = [infant, toddler, preschooler, schoolKid]

describe('seed data integrity', () => {
  it('has 25-30 restaurants across exactly two cities', () => {
    expect(SEED_RESTAURANTS.length).toBeGreaterThanOrEqual(25)
    expect(SEED_RESTAURANTS.length).toBeLessThanOrEqual(30)
    expect(CITIES).toHaveLength(2)
    for (const city of CITIES) {
      expect(SEED_RESTAURANTS.filter((r) => r.cityId === city.id).length).toBeGreaterThanOrEqual(10)
    }
  })

  it('uses unique ids and names', () => {
    expect(new Set(SEED_RESTAURANTS.map((r) => r.id)).size).toBe(SEED_RESTAURANTS.length)
    expect(new Set(SEED_RESTAURANTS.map((r) => r.name)).size).toBe(SEED_RESTAURANTS.length)
  })

  it('marks every record as fictional sample data with no street addresses', () => {
    for (const r of SEED_RESTAURANTS) {
      expect(r.isSample, r.id).toBe(true)
      expect(r.addressNote, r.id).toMatch(/^Sample listing/)
      expect(r.addressNote, `${r.id} should not carry a street number`).not.toMatch(/\d{2,}\s+\w+\s+(st|ave|rd|blvd)/i)
    }
  })

  it('places each restaurant within 25 km of its city centre', () => {
    for (const r of SEED_RESTAURANTS) {
      const city = CITIES.find((c) => c.id === r.cityId)
      expect(city, r.id).toBeDefined()
      if (city) expect(haversineKm(city.center, r.location), r.id).toBeLessThan(25)
    }
  })

  it('has well-formed attributes: dates in the past, counts positive', () => {
    for (const r of SEED_RESTAURANTS) {
      const confirmations = [...Object.values(r.attributes), ...Object.values(r.dietary)]
      expect(confirmations.length, r.id).toBeGreaterThan(0)
      for (const c of confirmations) {
        expect(c.lastConfirmedAt, r.id).toMatch(ISO_DATE)
        expect(c.lastConfirmedAt <= TODAY, `${r.id} confirmed in the future`).toBe(true)
        expect(c.confirmationCount, r.id).toBeGreaterThanOrEqual(1)
      }
      for (const key of Object.keys(r.attributes)) expect(ATTR_KEYS as readonly string[], `${r.id}: ${key}`).toContain(key)
    }
  })

  it('has valid hours, kid windows and wait peaks', () => {
    for (const r of SEED_RESTAURANTS) {
      expect(r.hours.length, r.id).toBeGreaterThan(0)
      const windows = [
        ...r.hours.map((h) => ({ days: h.days, a: h.open, b: h.close })),
        ...r.kidWindows.map((w) => ({ days: w.days, a: w.start, b: w.end })),
        ...r.waitProfile.peaks.map((p) => ({ days: p.days, a: p.start, b: p.end })),
      ]
      for (const w of windows) {
        expect(() => parseClock(w.a), r.id).not.toThrow()
        expect(() => parseClock(w.b), r.id).not.toThrow()
        for (const d of w.days) expect(WEEKDAYS as readonly string[], r.id).toContain(d)
      }
      expect(r.waitProfile.baseMinutes, r.id).toBeGreaterThanOrEqual(0)
    }
  })

  it('has consistent parent signals and honest copy', () => {
    for (const r of SEED_RESTAURANTS) {
      expect(r.parentSignals.wouldReturnCount, r.id).toBeLessThanOrEqual(r.parentSignals.reportCount)
      expect(r.parentSignals.notForUsCount, r.id).toBeLessThanOrEqual(r.parentSignals.reportCount)
      expect(r.menuHighlights.length, r.id).toBeGreaterThan(0)
      expect(r.watchOuts.length, r.id).toBeGreaterThan(0)
      expect(r.blurb.length, r.id).toBeGreaterThan(20)
    }
  })

  it('contains no paid placement', () => {
    expect(SEED_RESTAURANTS.filter((r) => r.listing && r.listing.kind !== 'organic')).toEqual([])
  })
})

describe('seed archetypes behave as designed under the default scoring', () => {
  const fit = (id: string, child = toddler) => scoreRestaurant(byId(id), [child])

  it('toddler-great but infant-poor: Little Fern Kitchen', () => {
    expect(fit('pdx-little-fern-kitchen', toddler).level).toBe('great')
    expect(fit('pdx-little-fern-kitchen', infant).level).toBe('poor')
  })

  it('infant-great but toddler-poor: The Quiet Spoon Tea Room', () => {
    expect(fit('chi-quiet-spoon-tea-room', infant).level).toBe('great')
    expect(fit('chi-quiet-spoon-tea-room', toddler).level).toBe('poor')
  })

  it('school-age great but loud (and flagged as loud): Tinderbox Pizza Yard', () => {
    const result = fit('pdx-tinderbox-pizza-yard', schoolKid)
    expect(result.level).toBe('great')
    expect(result.warnings).toContain('loud room')
    expect(fit('pdx-tinderbox-pizza-yard', infant).score).toBeLessThan(65)
  })

  it('a good restaurant that merely tolerates kids: Marlow & Finch Bistro', () => {
    expect(fit('pdx-marlow-finch-bistro', toddler).level).toBe('poor')
    expect(fit('pdx-marlow-finch-bistro', schoolKid).level).not.toBe('poor')
  })

  it('an all-rounder is great for every age: Fiddlehead Family Table', () => {
    for (const child of allBands) expect(fit('chi-fiddlehead-family-table', child).level).toBe('great')
  })

  it.each(['pdx-saltbox-seafood-counter', 'pdx-velvet-ladle', 'chi-pearl-street-oyster-parlor', 'chi-gallery-14-tasting-room'])(
    'bad fits are poor for every age: %s',
    (id) => {
      for (const child of allBands) {
        const result = fit(id, child)
        expect(result.level, `${id} for ${child.id}`).toBe('poor')
        expect(result.score).toBeLessThanOrEqual(40)
      }
    },
  )

  it.each(['pdx-harbor-hearth-noodle-bar', 'chi-kettle-crumb-cafe'])('new listings say "not enough info": %s', (id) => {
    for (const child of allBands) expect(fit(id, child).level).toBe('unknown')
  })

  it('spreads across the whole scale so the UI gets realistic variety', () => {
    const levels = new Set(SEED_RESTAURANTS.flatMap((r) => allBands.map((c) => scoreRestaurant(r, [c]).level)))
    expect(levels).toEqual(new Set(['great', 'good', 'mixed', 'poor', 'unknown']))
  })
})
