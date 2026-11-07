import { describe, expect, it } from 'vitest'
import { createMemoryStore } from './keyValueStore'
import { createLocalRepository } from './localRepository'
import type { NewFeedback, TripList } from './types'

// Saturday 2026-11-07, 11:00 in Portland (PST) and 13:00 in Chicago (CST).
const SATURDAY_MIDDAY = new Date('2026-11-07T19:00:00Z')
const fixedNow = () => SATURDAY_MIDDAY

const makeRepo = (store = createMemoryStore()) => createLocalRepository({ store, now: fixedNow })

const feedback: NewFeedback = {
  restaurantId: 'pdx-little-fern-kitchen',
  reporterBands: ['toddler', 'preschool'],
  hadHighChair: 'yes',
  staffWelcoming: 'yes',
  waitMinutes: 10,
  noise: 'loud',
  wouldReturn: true,
  notForUs: false,
}

describe('restaurants', () => {
  it('lists everything alphabetically by default', async () => {
    const all = await makeRepo().listRestaurants()
    expect(all.length).toBeGreaterThanOrEqual(25)
    expect([...all].sort((a, b) => a.name.localeCompare(b.name)).map((r) => r.id)).toEqual(all.map((r) => r.id))
  })

  it('gets one by id, or null', async () => {
    const repo = makeRepo()
    expect((await repo.getRestaurant('pdx-little-fern-kitchen'))?.name).toBe('Little Fern Kitchen')
    expect(await repo.getRestaurant('nope')).toBeNull()
  })

  it('filters by city', async () => {
    const chicago = await makeRepo().listRestaurants({ cityId: 'chicago' })
    expect(chicago.length).toBeGreaterThan(0)
    expect(chicago.every((r) => r.cityId === 'chicago')).toBe(true)
  })

  it('searches name, cuisine and neighbourhood case-insensitively', async () => {
    const repo = makeRepo()
    expect((await repo.listRestaurants({ text: 'FERN' })).map((r) => r.id)).toEqual(['pdx-little-fern-kitchen'])
    expect((await repo.listRestaurants({ text: 'hyde park' })).map((r) => r.id)).toEqual(['chi-quiet-spoon-tea-room'])
    expect((await repo.listRestaurants({ text: 'ramen' })).map((r) => r.id)).toEqual(['chi-cinder-ramen-house'])
  })

  it('filters by maximum price', async () => {
    const cheap = await makeRepo().listRestaurants({ maxPriceLevel: 1 })
    expect(cheap.length).toBeGreaterThan(0)
    expect(cheap.every((r) => r.priceLevel === 1)).toBe(true)
  })

  it('filters by cuisine using the names listCuisines returns', async () => {
    const repo = makeRepo()
    const cuisines = await repo.listCuisines('chicago')
    expect(cuisines).toContain('Ramen')
    expect([...cuisines].sort((a, b) => a.localeCompare(b))).toEqual(cuisines)
    expect((await repo.listRestaurants({ cuisines: ['Ramen'] })).map((r) => r.id)).toEqual(['chi-cinder-ramen-house'])
  })

  it('filters by reported dietary options and only counts options parents say exist', async () => {
    const result = await makeRepo().listRestaurants({ dietary: ['nutAllergyAware'] })
    const ids = result.map((r) => r.id)
    expect(ids).toContain('pdx-marlow-finch-bistro')
    // These two report "nut-allergy aware: false" and must NOT match.
    expect(ids).not.toContain('pdx-saltbox-seafood-counter')
    expect(ids).not.toContain('chi-saffron-table')
  })

  it('filters by open now in each restaurant’s local time', async () => {
    const open = (await makeRepo().listRestaurants({ openAt: SATURDAY_MIDDAY })).map((r) => r.id)
    expect(open).toContain('pdx-little-fern-kitchen') // 08:00-15:00
    expect(open).toContain('chi-little-lark-pancake-house') // 07:00-15:00, 13:00 in Chicago
    expect(open).not.toContain('pdx-velvet-ladle') // Wed-Sat evenings only
    expect(open).not.toContain('chi-gallery-14-tasting-room') // Thu-Sat evenings only
  })
})

describe('findNearby', () => {
  const downtownPortland = { lat: 45.5231, lng: -122.6765 }

  it('returns the nearest first, with distances', async () => {
    const results = await makeRepo().findNearby(downtownPortland, { cityId: 'portland' })
    const distances = results.map((r) => r.distanceKm)
    expect([...distances].sort((a, b) => a - b)).toEqual(distances)
    expect(results.every((r) => r.restaurant.cityId === 'portland')).toBe(true)
  })

  it('honours limit, maxKm and open-now', async () => {
    const repo = makeRepo()
    expect(await repo.findNearby(downtownPortland, { cityId: 'portland', limit: 3 })).toHaveLength(3)
    const near = await repo.findNearby(downtownPortland, { maxKm: 3 })
    expect(near.every((r) => r.distanceKm <= 3)).toBe(true)
    const open = await repo.findNearby(downtownPortland, { cityId: 'portland', openAt: SATURDAY_MIDDAY })
    expect(open.map((r) => r.restaurant.id)).not.toContain('pdx-velvet-ladle')
  })
})

describe('wait estimates', () => {
  it('come from the simulated provider and are labelled as such', async () => {
    const wait = await makeRepo().getWait('pdx-little-fern-kitchen')
    expect(wait?.source).toBe('simulated')
    expect(wait?.asOf).toBe(SATURDAY_MIDDAY.toISOString())
  })

  it('returns null for an unknown restaurant', async () => {
    expect(await makeRepo().getWait('nope')).toBeNull()
  })

  it('can be swapped for a real provider without touching callers', async () => {
    const repo = createLocalRepository({
      waitProvider: {
        getWait: () => Promise.resolve({ minutes: 45, level: 'long', source: 'live', asOf: 'now' }),
      },
    })
    expect((await repo.getWait('pdx-little-fern-kitchen'))?.source).toBe('live')
  })
})

describe('feedback', () => {
  it('stores feedback tagged by age band and returns it for that restaurant only', async () => {
    const repo = makeRepo()
    const saved = await repo.addFeedback(feedback)
    expect(saved.id).toBeTruthy()
    expect(saved.createdAt).toBe(SATURDAY_MIDDAY.toISOString())
    expect(saved.reporterBands).toEqual(['toddler', 'preschool'])
    expect(await repo.listFeedback('pdx-little-fern-kitchen')).toEqual([saved])
    expect(await repo.listFeedback('pdx-velvet-ladle')).toEqual([])
  })

  it('persists across repository instances that share a store', async () => {
    const store = createMemoryStore()
    await makeRepo(store).addFeedback(feedback)
    expect(await makeRepo(store).listFeedback('pdx-little-fern-kitchen')).toHaveLength(1)
  })

  it('gives each report a unique id', async () => {
    const repo = makeRepo()
    const a = await repo.addFeedback(feedback)
    const b = await repo.addFeedback(feedback)
    expect(a.id).not.toBe(b.id)
  })

  it('rejects unknown restaurants, untagged reports and negative waits', async () => {
    const repo = makeRepo()
    await expect(repo.addFeedback({ ...feedback, restaurantId: 'nope' })).rejects.toThrow(RangeError)
    await expect(repo.addFeedback({ ...feedback, reporterBands: [] })).rejects.toThrow(/age band/)
    await expect(repo.addFeedback({ ...feedback, waitMinutes: -5 })).rejects.toThrow(RangeError)
  })

  it('survives corrupt stored data instead of crashing', async () => {
    const store = createMemoryStore({ 'tableside.v1.feedback': '{not json', 'tableside.v1.tripLists': '"a string"' })
    const repo = makeRepo(store)
    expect(await repo.listFeedback('pdx-little-fern-kitchen')).toEqual([])
    expect(await repo.listTripLists()).toEqual([])
    // …and can still write afterwards.
    await repo.addFeedback(feedback)
    expect(await repo.listFeedback('pdx-little-fern-kitchen')).toHaveLength(1)
  })

  it('drops stored entries that do not look like feedback', async () => {
    const store = createMemoryStore({ 'tableside.v1.feedback': JSON.stringify([{ id: 1 }, null, 'x']) })
    expect(await makeRepo(store).listFeedback('pdx-little-fern-kitchen')).toEqual([])
  })
})

describe('trip lists', () => {
  const list: TripList = {
    id: 'trip-1',
    name: 'Portland weekend',
    restaurantIds: ['pdx-little-fern-kitchen'],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  }

  it('creates, updates and deletes lists', async () => {
    const repo = makeRepo()
    await repo.saveTripList(list)
    expect(await repo.listTripLists()).toHaveLength(1)

    const updated = await repo.saveTripList({ ...list, restaurantIds: [...list.restaurantIds, 'pdx-copper-kettle-dumpling-house'] })
    expect(updated.updatedAt).toBe(SATURDAY_MIDDAY.toISOString())
    const lists = await repo.listTripLists()
    expect(lists).toHaveLength(1)
    expect(lists[0]?.restaurantIds).toHaveLength(2)

    await repo.deleteTripList('trip-1')
    expect(await repo.listTripLists()).toEqual([])
  })

  it('persists across repository instances that share a store', async () => {
    const store = createMemoryStore()
    await makeRepo(store).saveTripList(list)
    expect(await makeRepo(store).listTripLists()).toHaveLength(1)
  })
})
