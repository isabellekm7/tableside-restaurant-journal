import { describe, expect, it } from 'vitest'
import { attrs } from '../../data/seed/helpers'
import { SEED_RESTAURANTS } from '../../data/seed'
import type { KidAttributeValues } from '../../data/types'
import { childFromAge, childFromBand } from './ageBands'
import { DEFAULT_SCORING_CONFIG, type ScoringConfig } from './config'
import { scoreChild, scoreRestaurant, type ScorableRestaurant } from './score'

const confirmed = { count: 10, date: '2026-10-01' }
const noSignals = { reportCount: 0, wouldReturnCount: 0, notForUsCount: 0 }

const make = (spec: Partial<KidAttributeValues>, signals = noSignals): ScorableRestaurant => ({
  attributes: attrs(spec, confirmed),
  parentSignals: signals,
})

const infant = childFromAge('infant', 0)
const toddler = childFromAge('toddler', 2)
const preschooler = childFromAge('preschooler', 5)
const schoolKid = childFromAge('school', 8)

/** Everything a toddler wants. */
const toddlerDream: Partial<KidAttributeValues> = {
  highChairs: 4,
  foodSpeed: 'fast',
  staffWelcome: 'warm',
  noiseLevel: 'loud',
  messTolerance: 'high',
  sippyCupFriendly: true,
  changingTable: true,
  kidsMenu: true,
  strollerSpace: true,
  customizableDishes: true,
  outdoorSpace: true,
}

/** Everything an infant wants. */
const infantDream: Partial<KidAttributeValues> = {
  changingTable: true,
  strollerSpace: true,
  nursingFriendly: true,
  carrierRoom: true,
  quietCorner: true,
  noiseLevel: 'quiet',
  staffWelcome: 'warm',
  highChairs: 2,
  foodSpeed: 'fast',
  messTolerance: 'high',
}

describe('scoreRestaurant: one child', () => {
  it('rates a toddler-ready restaurant great and says why', () => {
    const result = scoreRestaurant(make(toddlerDream), [toddler])
    expect(result.level).toBe('great')
    expect(result.label).toBe('Great fit')
    expect(result.reasons).toContain('4 high chairs')
    expect(result.reasons).toContain('fast kitchen')
    expect(result.summary).toMatch(/^Great for your 2-year-old: /)
    expect(result.drivingChildId).toBe('toddler')
    expect(result.perChild).toHaveLength(1)
  })

  it('caps a toddler at "poor" when there are no high chairs, and explains it', () => {
    const result = scoreRestaurant(make({ ...toddlerDream, highChairs: 0 }), [toddler])
    expect(result.score).toBeLessThanOrEqual(40)
    expect(result.level).toBe('poor')
    expect(result.warnings).toContain('no high chairs')
    expect(result.perChild[0]?.capped).toBe(true)
    expect(result.summary).toContain('no high chairs')
  })

  it('caps an infant below "good" when there is no changing table', () => {
    const withTable = scoreRestaurant(make(infantDream), [infant])
    const without = scoreRestaurant(make({ ...infantDream, changingTable: false }), [infant])
    expect(withTable.level).toBe('great')
    expect(without.score).toBeLessThanOrEqual(64)
    expect(without.level).toBe('mixed')
    expect(without.warnings).toContain('no changing table')
  })

  it('treats noise differently per age band', () => {
    const base = { ...toddlerDream, ...infantDream }
    const loud = make({ ...base, noiseLevel: 'loud' })
    const quiet = make({ ...base, noiseLevel: 'quiet' })
    const moderate = make({ ...base, noiseLevel: 'moderate', menuVariety: 'wide', activities: true })

    expect(scoreChild(loud, toddler).score).toBeGreaterThan(scoreChild(quiet, toddler).score)
    expect(scoreChild(quiet, infant).score).toBeGreaterThan(scoreChild(loud, infant).score)
    // School-age kids prefer "not too loud, not silent".
    expect(scoreChild(moderate, schoolKid).score).toBeGreaterThan(scoreChild(quiet, schoolKid).score)
    expect(scoreChild(moderate, schoolKid).score).toBeGreaterThan(scoreChild(loud, schoolKid).score)
  })

  it('does not treat an unreported attribute as "no"', () => {
    const { changingTable: _removed, ...withoutTable } = toddlerDream
    const unknown = scoreChild(make(withoutTable), toddler)
    const reportedNo = scoreChild(make({ ...toddlerDream, changingTable: false }), toddler)
    expect(unknown.score).toBeGreaterThan(reportedNo.score)
  })

  it('says "not enough info" when too little has been reported', () => {
    const result = scoreRestaurant(make({ kidsMenu: true, staffWelcome: 'warm' }), [toddler])
    expect(result.level).toBe('unknown')
    expect(result.label).toBe('Not enough info')
    expect(result.confidence).toBe('low')
    expect(result.summary).toMatch(/not enough parent reports/i)
  })

  it('reports high confidence when nearly everything is known', () => {
    expect(scoreRestaurant(make(toddlerDream), [toddler]).confidence).toBe('high')
  })

  it.each([
    ['infant', infant, infantDream],
    ['toddler', toddler, toddlerDream],
    ['preschool', preschooler, { kidsMenu: true, activities: true, boosterSeats: true, customizableDishes: true, foodSpeed: 'fast', noiseLevel: 'moderate', messTolerance: 'high', outdoorSpace: true }],
    ['school-age', schoolKid, { menuVariety: 'wide', outdoorSpace: true, nearbyPark: true, noiseLevel: 'moderate', activities: true, foodSpeed: 'fast', kidsMenu: true, customizableDishes: true }],
  ] as const)('caps every band at 40 when staff are not welcoming (%s)', (_name, child, spec) => {
    const welcoming = scoreChild(make({ ...spec, staffWelcome: 'warm' }), child)
    const cool = scoreChild(make({ ...spec, staffWelcome: 'cool' }), child)
    expect(welcoming.score).toBeGreaterThan(40)
    expect(cool.score).toBeLessThanOrEqual(40)
    expect(cool.warnings).toContain('staff may not feel welcoming to families')
  })
})

describe('scoreRestaurant: "Not for us" reports', () => {
  it('caps the score when enough parents felt unwelcome', () => {
    const calm = scoreRestaurant(make(toddlerDream), [toddler])
    const flagged = scoreRestaurant(make(toddlerDream, { reportCount: 20, wouldReturnCount: 5, notForUsCount: 6 }), [toddler])
    expect(calm.score).toBeGreaterThan(50)
    expect(flagged.score).toBeLessThanOrEqual(50)
    expect(flagged.warnings).toContain('some parents said they felt unwelcome here')
  })

  it('ignores the signal when there are too few reports to mean anything', () => {
    const fewReports = scoreRestaurant(make(toddlerDream, { reportCount: 3, wouldReturnCount: 0, notForUsCount: 3 }), [toddler])
    expect(fewReports.score).toBe(scoreRestaurant(make(toddlerDream), [toddler]).score)
  })
})

describe('scoreRestaurant: several children', () => {
  // No high chairs: terrible for the toddler, perfect for the 5-year-old.
  const preschoolerPlace = make({
    highChairs: 0,
    boosterSeats: true,
    kidsMenu: true,
    activities: true,
    customizableDishes: true,
    staffWelcome: 'warm',
    foodSpeed: 'fast',
    noiseLevel: 'moderate',
    messTolerance: 'high',
    outdoorSpace: true,
    sippyCupFriendly: true,
    changingTable: true,
    strollerSpace: true,
  })

  it('uses the strictest child and names who drove the result', () => {
    const result = scoreRestaurant(preschoolerPlace, [preschooler, toddler])
    const toddlerFit = result.perChild.find((c) => c.childId === 'toddler')
    const preschoolFit = result.perChild.find((c) => c.childId === 'preschooler')

    expect(result.drivingChildId).toBe('toddler')
    expect(result.score).toBe(toddlerFit?.score)
    expect(result.score).toBeLessThan(preschoolFit?.score ?? 0)
    expect(result.level).toBe('poor')
    expect(result.summary).toContain('Held back by your 2-year-old: no high chairs')
    expect(result.summary).toContain('Works well for your 5-year-old')
    expect(result.warnings).toContain('Your 2-year-old: no high chairs')
  })

  it('gives the same answer whatever order the children are listed in', () => {
    const a = scoreRestaurant(preschoolerPlace, [preschooler, toddler])
    const b = scoreRestaurant(preschoolerPlace, [toddler, preschooler])
    expect(b.score).toBe(a.score)
    expect(b.drivingChildId).toBe(a.drivingChildId)
    expect(b.summary).toBe(a.summary)
  })

  it('reads as one verdict when everyone fits about equally', () => {
    const allRounder = SEED_RESTAURANTS.find((r) => r.id === 'chi-fiddlehead-family-table')
    if (!allRounder) throw new Error('missing seed restaurant')
    const result = scoreRestaurant(allRounder, [toddler, infant])
    expect(result.level).toBe('great')
    expect(result.summary).toMatch(/^Great for all of your kids: /)
  })

  it('words a poor fit for the whole group naturally', () => {
    const steakhouse = SEED_RESTAURANTS.find((r) => r.id === 'pdx-ember-oak-steakhouse')
    if (!steakhouse) throw new Error('missing seed restaurant')
    const result = scoreRestaurant(steakhouse, [toddler, preschooler])
    expect(result.level).toBe('poor')
    expect(result.summary).toMatch(/^Not a good fit for your kids: /)
  })

  it('mentions children it has no data for, without letting them drag the score', () => {
    // Toddler data is rich; the few facts that matter to a school-age child are missing.
    const { kidsMenu: _k, customizableDishes: _c, outdoorSpace: _o, ...toddlerOnlyFacts } = toddlerDream
    const result = scoreRestaurant(make(toddlerOnlyFacts), [toddler, schoolKid])
    expect(result.perChild.find((c) => c.childId === 'school')?.level).toBe('unknown')
    expect(result.level).toBe('great')
    expect(result.summary).toContain('Not enough parent reports yet for your 8-year-old')
  })

  it('is unknown only when it is unknown for every child', () => {
    const result = scoreRestaurant(make({ kidsMenu: true }), [toddler, schoolKid])
    expect(result.level).toBe('unknown')
  })

  it('handles children added by band only', () => {
    const result = scoreRestaurant(make(toddlerDream), [childFromBand('b', 'toddler')])
    expect(result.summary).toMatch(/your toddler/)
  })
})

describe('scoreRestaurant: no children yet', () => {
  it('falls back to a generic family read and invites the user to add ages', () => {
    const result = scoreRestaurant(make({ staffWelcome: 'warm', kidsMenu: true, menuVariety: 'wide', noiseLevel: 'moderate', highChairs: 3, foodSpeed: 'fast' }), [])
    expect(result.perChild).toEqual([])
    expect(result.drivingChildId).toBeNull()
    expect(['great', 'good']).toContain(result.level)
    expect(result.summary).toContain('Add your kids’ ages')
  })
})

describe('scoreRestaurant: purity and trust', () => {
  it('is deterministic and never mutates its inputs', () => {
    const restaurant = make(toddlerDream)
    const children = [toddler, schoolKid]
    const before = JSON.stringify({ restaurant, children })
    const first = scoreRestaurant(restaurant, children)
    const second = scoreRestaurant(restaurant, children)
    expect(second).toEqual(first)
    expect(JSON.stringify({ restaurant, children })).toBe(before)
  })

  it('ignores paid placement entirely: a sponsored listing scores exactly like an organic one', () => {
    for (const restaurant of SEED_RESTAURANTS) {
      const sponsored = { ...restaurant, listing: { kind: 'sponsored' as const, partner: 'Example Media' } }
      const organic = { ...restaurant, listing: { kind: 'organic' as const } }
      for (const kids of [[], [infant], [toddler, schoolKid], [infant, toddler, preschooler, schoolKid]]) {
        expect(scoreRestaurant(sponsored, kids)).toEqual(scoreRestaurant(organic, kids))
      }
    }
  })
})

describe('scoring config', () => {
  it('has every weight between 0 and 10 and at least one weight per band', () => {
    for (const [band, config] of Object.entries(DEFAULT_SCORING_CONFIG.bands)) {
      const weights = Object.values(config.weights)
      expect(weights.length, `${band} has weights`).toBeGreaterThan(0)
      for (const w of weights) {
        expect(w).toBeGreaterThanOrEqual(0)
        expect(w).toBeLessThanOrEqual(10)
      }
    }
  })

  it('has level thresholds in descending order', () => {
    const { great, good, mixed } = DEFAULT_SCORING_CONFIG.levels
    expect(great).toBeGreaterThan(good)
    expect(good).toBeGreaterThan(mixed)
  })

  it('drives the result: changing the config changes the score without touching code', () => {
    const restaurant = make({ highChairs: 5, foodSpeed: 'slow' })
    const onlyHighChairs: ScoringConfig = {
      ...DEFAULT_SCORING_CONFIG,
      bands: {
        ...DEFAULT_SCORING_CONFIG.bands,
        toddler: { ...DEFAULT_SCORING_CONFIG.bands.toddler, weights: { highChairs: 10 }, caps: [] },
      },
    }
    expect(scoreChild(restaurant, toddler, DEFAULT_SCORING_CONFIG).score).toBeLessThan(90)
    expect(scoreChild(restaurant, toddler, onlyHighChairs).score).toBe(100)
  })
})
