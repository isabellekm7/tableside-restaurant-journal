import { filterRestaurants, findNearby, listCuisines } from './catalogQueries'
import { createMemoryStore, type KeyValueStore } from './keyValueStore'
import type { NearbyOptions, RestaurantRepository, WaitProvider } from './repository'
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

/** The local repository can also adopt records that were saved elsewhere (e.g. synced to a backend). */
export interface LocalRepository extends RestaurantRepository {
  /** Store a feedback record exactly as given (idempotent by id). */
  rememberFeedback(feedback: ParentFeedback): void
  /** Store a trip list exactly as given (no timestamp changes). */
  rememberTripList(list: TripList): void
}

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

// ───────────── Implementation ─────────────

/** Repository backed by the bundled sample data plus a key-value store for user data. */
export function createLocalRepository(options: LocalRepositoryOptions = {}): LocalRepository {
  const restaurants = options.restaurants ?? SEED_RESTAURANTS
  const cities = options.cities ?? CITIES
  const store = options.store ?? createMemoryStore()
  const waitProvider = options.waitProvider ?? createSimulatedWaitProvider(cities)
  const now = options.now ?? (() => new Date())
  let counter = 0
  const makeId = options.makeId ?? (() => `${now().getTime().toString(36)}-${(counter++).toString(36)}`)

  const find = (id: string) => restaurants.find((r) => r.id === id) ?? null

  return {
    rememberFeedback(feedback) {
      const existing = readList(store, FEEDBACK_KEY, isParentFeedback)
      writeList(store, FEEDBACK_KEY, [...existing.filter((f) => f.id !== feedback.id), feedback])
    },

    rememberTripList(list) {
      const existing = readList(store, TRIP_LISTS_KEY, isTripList)
      writeList(store, TRIP_LISTS_KEY, existing.some((l) => l.id === list.id) ? existing.map((l) => (l.id === list.id ? list : l)) : [...existing, list])
    },

    listCities: () => Promise.resolve([...cities]),

    listCuisines: (cityId) => Promise.resolve(listCuisines(restaurants, cityId)),

    listRestaurants: (query = {}) => Promise.resolve(filterRestaurants(restaurants, cities, query)),

    getRestaurant: (id) => Promise.resolve(find(id)),

    findNearby: (origin, opts: NearbyOptions = {}) => Promise.resolve(findNearby(restaurants, cities, origin, opts)),

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
