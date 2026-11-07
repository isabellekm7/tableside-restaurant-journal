import { haversineKm } from '../lib/geo/distance'
import { isOpenAt } from '../lib/time/hours'
import { createMemoryStore, type KeyValueStore } from './keyValueStore'
import type { NearbyOptions, NearbyResult, RestaurantQuery, RestaurantRepository, WaitProvider } from './repository'
import { CITIES, SEED_RESTAURANTS } from './seed'
import { createSimulatedWaitProvider } from './simulatedWait'
import {
  AGE_BANDS,
  type City,
  type NewFeedback,
  type ParentFeedback,
  type Restaurant,
  type TripList,
} from './types'

const FEEDBACK_KEY = 'tableside.v1.feedback'
const TRIP_LISTS_KEY = 'tableside.v1.tripLists'

export interface LocalRepositoryOptions {
  restaurants?: readonly Restaurant[]
  cities?: readonly City[]
  /** Where feedback and trip lists persist. Defaults to memory. */
  store?: KeyValueStore
  waitProvider?: WaitProvider
  now?: () => Date
  makeId?: () => string
}

// ───────────── Stored-data validation (storage is untrusted: users can edit it) ─────────────

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

function isParentFeedback(v: unknown): v is ParentFeedback {
  if (!isRecord(v)) return false
  return (
    typeof v.id === 'string' &&
    typeof v.restaurantId === 'string' &&
    typeof v.createdAt === 'string' &&
    Array.isArray(v.reporterBands) &&
    v.reporterBands.every((b) => AGE_BANDS.some((band) => band === b)) &&
    typeof v.waitMinutes === 'number' &&
    typeof v.wouldReturn === 'boolean' &&
    typeof v.notForUs === 'boolean' &&
    typeof v.hadHighChair === 'string' &&
    typeof v.staffWelcoming === 'string' &&
    typeof v.noise === 'string'
  )
}

function isTripList(v: unknown): v is TripList {
  if (!isRecord(v)) return false
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    Array.isArray(v.restaurantIds) &&
    v.restaurantIds.every((id) => typeof id === 'string') &&
    typeof v.createdAt === 'string' &&
    typeof v.updatedAt === 'string'
  )
}

function readList<T>(store: KeyValueStore, key: string, guard: (v: unknown) => v is T): T[] {
  try {
    const raw = store.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(guard) : []
  } catch {
    return [] // Corrupt data must never break the app.
  }
}

function writeList<T>(store: KeyValueStore, key: string, list: readonly T[]): void {
  try {
    store.setItem(key, JSON.stringify(list))
  } catch {
    // Quota exceeded or storage blocked: the in-memory result is still returned.
  }
}

// ───────────── Filtering ─────────────

function matchesQuery(r: Restaurant, q: RestaurantQuery, cities: readonly City[]): boolean {
  if (q.cityId && r.cityId !== q.cityId) return false
  if (q.maxPriceLevel !== undefined && r.priceLevel > q.maxPriceLevel) return false
  if (q.cuisines?.length && !q.cuisines.includes(r.cuisine)) return false
  if (q.dietary?.length && !q.dietary.every((tag) => r.dietary[tag]?.value === true)) return false
  const text = q.text?.trim().toLowerCase()
  if (text && !`${r.name} ${r.cuisine} ${r.neighborhood}`.toLowerCase().includes(text)) return false
  if (q.openAt) {
    const city = cities.find((c) => c.id === r.cityId)
    if (!city || !isOpenAt(r.hours, city.timeZone, q.openAt)) return false
  }
  return true
}

const byName = (a: Restaurant, b: Restaurant) => a.name.localeCompare(b.name)

// ───────────── Implementation ─────────────

/** Repository backed by the bundled sample data plus a key-value store for user data. */
export function createLocalRepository(options: LocalRepositoryOptions = {}): RestaurantRepository {
  const restaurants = options.restaurants ?? SEED_RESTAURANTS
  const cities = options.cities ?? CITIES
  const store = options.store ?? createMemoryStore()
  const waitProvider = options.waitProvider ?? createSimulatedWaitProvider(cities)
  const now = options.now ?? (() => new Date())
  let counter = 0
  const makeId = options.makeId ?? (() => `${now().getTime().toString(36)}-${(counter++).toString(36)}`)

  const find = (id: string) => restaurants.find((r) => r.id === id) ?? null

  return {
    listCities: () => Promise.resolve([...cities]),

    listCuisines(cityId) {
      const names = restaurants.filter((r) => !cityId || r.cityId === cityId).map((r) => r.cuisine)
      return Promise.resolve([...new Set(names)].sort((a, b) => a.localeCompare(b)))
    },

    listRestaurants(query = {}) {
      return Promise.resolve(restaurants.filter((r) => matchesQuery(r, query, cities)).sort(byName))
    },

    getRestaurant: (id) => Promise.resolve(find(id)),

    findNearby(origin, opts: NearbyOptions = {}) {
      const results: NearbyResult[] = restaurants
        .filter((r) => matchesQuery(r, { cityId: opts.cityId, openAt: opts.openAt }, cities))
        .map((restaurant) => ({ restaurant, distanceKm: haversineKm(origin, restaurant.location) }))
        .filter((r) => opts.maxKm === undefined || r.distanceKm <= opts.maxKm)
        .sort((a, b) => a.distanceKm - b.distanceKm)
      return Promise.resolve(opts.limit === undefined ? results : results.slice(0, opts.limit))
    },

    getWait(restaurantId, at = now()) {
      const restaurant = find(restaurantId)
      return restaurant ? waitProvider.getWait(restaurant, at) : Promise.resolve(null)
    },

    listFeedback(restaurantId) {
      const all = readList(store, FEEDBACK_KEY, isParentFeedback)
      return Promise.resolve(all.filter((f) => f.restaurantId === restaurantId))
    },

    addFeedback(input: NewFeedback) {
      if (!find(input.restaurantId)) return Promise.reject(new RangeError(`Unknown restaurant "${input.restaurantId}"`))
      if (input.reporterBands.length === 0) {
        return Promise.reject(new RangeError('Feedback must be tagged with at least one child age band'))
      }
      if (!Number.isFinite(input.waitMinutes) || input.waitMinutes < 0) {
        return Promise.reject(new RangeError('waitMinutes must be zero or more'))
      }
      const feedback: ParentFeedback = { ...input, id: makeId(), createdAt: now().toISOString() }
      writeList(store, FEEDBACK_KEY, [...readList(store, FEEDBACK_KEY, isParentFeedback), feedback])
      return Promise.resolve(feedback)
    },

    listTripLists: () => Promise.resolve(readList(store, TRIP_LISTS_KEY, isTripList)),

    saveTripList(list) {
      const existing = readList(store, TRIP_LISTS_KEY, isTripList)
      const saved: TripList = { ...list, updatedAt: now().toISOString() }
      const next = existing.some((l) => l.id === list.id)
        ? existing.map((l) => (l.id === list.id ? saved : l))
        : [...existing, saved]
      writeList(store, TRIP_LISTS_KEY, next)
      return Promise.resolve(saved)
    },

    deleteTripList(id) {
      writeList(
        store,
        TRIP_LISTS_KEY,
        readList(store, TRIP_LISTS_KEY, isTripList).filter((l) => l.id !== id),
      )
      return Promise.resolve()
    },
  }
}
