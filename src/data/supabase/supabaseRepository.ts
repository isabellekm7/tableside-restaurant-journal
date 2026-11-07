import type { SupabaseClient } from '@supabase/supabase-js'
import { filterRestaurants, findNearby, listCuisines } from '../catalogQueries'
import type { RestaurantRepository, WaitProvider } from '../repository'
import { createSimulatedWaitProvider } from '../simulatedWait'
import type { City, NewFeedback, ParentFeedback, Restaurant, TripList } from '../types'
import { feedbackToRow, parseAll, parseCity, parseFeedback, parseRestaurant, parseTripList, tripListToRow } from './parse'

export interface SupabaseRepositoryOptions {
  now?: () => Date
  makeId?: () => string
  /** Where waits come from. Defaults to the simulated provider (waits are not stored in Supabase). */
  waitProvider?: WaitProvider
  /** How long the catalog is reused before it is re-fetched. */
  catalogTtlMs?: number
}

interface Catalog {
  cities: City[]
  restaurants: Restaurant[]
  fetchedAt: number
}

/** Thrown when a write needs a signed-in (anonymous) user and none could be created. */
export class AuthUnavailableError extends Error {
  constructor() {
    super('Anonymous sign-in is unavailable, so this can only be saved on this device.')
    this.name = 'AuthUnavailableError'
  }
}

const SIGN_IN_RETRY_MS = 60_000

function defaultId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * RestaurantRepository backed by Supabase.
 *
 * - Catalog: the whole (small) catalog is fetched once and cached; filtering is shared
 *   with the local repository so results are identical whatever the source. For a
 *   large catalog, move the filters server-side here: the interface already allows it.
 * - Feedback: INSERT-only for anonymous users (see the RLS policies); the row's id is
 *   generated here so no read-back, which anonymous users aren't allowed, is needed.
 * - Trip lists: per anonymous user. The first write signs the device in anonymously.
 *
 * Methods throw on network/permission errors; wrap with createResilientRepository for
 * offline fallback. Library-level retries are disabled on purpose: with a local fallback,
 * failing fast beats making an offline user wait through backoff delays.
 */
export function createSupabaseRepository(client: SupabaseClient, options: SupabaseRepositoryOptions = {}): RestaurantRepository {
  const now = options.now ?? (() => new Date())
  const makeId = options.makeId ?? defaultId
  const ttl = options.catalogTtlMs ?? 5 * 60_000
  let catalog: Catalog | null = null
  let loading: Promise<Catalog> | null = null

  async function fetchCatalog(): Promise<Catalog> {
    const [citiesResult, restaurantsResult] = await Promise.all([
      client.from('cities').select('*').retry(false),
      client.from('restaurants').select('*, restaurant_attributes(*), restaurant_dietary(*)').retry(false),
    ])
    if (citiesResult.error) throw new Error(`cities: ${citiesResult.error.message}`)
    if (restaurantsResult.error) throw new Error(`restaurants: ${restaurantsResult.error.message}`)
    const cities = parseAll(citiesResult.data, parseCity)
    const restaurants = parseAll(restaurantsResult.data, parseRestaurant)
    // An empty or wholly unparseable catalog means the schema doesn't match: don't pretend it's fine.
    if (cities.length === 0 || restaurants.length === 0) throw new Error('catalog is empty or has an unexpected shape')
    return { cities, restaurants, fetchedAt: now().getTime() }
  }

  async function loadCatalog(): Promise<Catalog> {
    if (catalog && now().getTime() - catalog.fetchedAt < ttl) return catalog
    loading ??= fetchCatalog()
      .then((fresh) => {
        catalog = fresh
        return fresh
      })
      .finally(() => {
        loading = null
      })
    try {
      return await loading
    } catch (error) {
      if (catalog) return catalog // a stale catalog beats no catalog
      throw error
    }
  }

  const waitProvider = options.waitProvider

  // ── Anonymous session ──
  let signingIn: Promise<string | null> | null = null
  let lastSignInFailure = 0

  async function currentUserId(): Promise<string | null> {
    const { data } = await client.auth.getSession()
    return data.session?.user.id ?? null
  }

  /** Existing user, or a new anonymous one. Null (without retrying for a minute) if anonymous sign-in is off. */
  async function ensureUserId(): Promise<string | null> {
    const existing = await currentUserId()
    if (existing) return existing
    if (now().getTime() - lastSignInFailure < SIGN_IN_RETRY_MS) return null
    signingIn ??= client.auth
      .signInAnonymously()
      .then(({ data, error }) => {
        if (error || !data.user) {
          lastSignInFailure = now().getTime()
          return null
        }
        return data.user.id
      })
      .finally(() => {
        signingIn = null
      })
    return signingIn
  }

  return {
    async listCities() {
      return (await loadCatalog()).cities
    },

    async listCuisines(cityId) {
      return listCuisines((await loadCatalog()).restaurants, cityId)
    },

    async listRestaurants(query = {}) {
      const { restaurants, cities } = await loadCatalog()
      return filterRestaurants(restaurants, cities, query)
    },

    async getRestaurant(id) {
      return (await loadCatalog()).restaurants.find((r) => r.id === id) ?? null
    },

    async findNearby(origin, opts = {}) {
      const { restaurants, cities } = await loadCatalog()
      return findNearby(restaurants, cities, origin, opts)
    },

    async getWait(restaurantId, at = now()) {
      const { restaurants, cities } = await loadCatalog()
      const restaurant = restaurants.find((r) => r.id === restaurantId)
      if (!restaurant) return null
      return (waitProvider ?? createSimulatedWaitProvider(cities)).getWait(restaurant, at)
    },

    async listFeedback(restaurantId) {
      if (!(await currentUserId())) return [] // anonymous visitors can't read back, by design
      const { data, error } = await client.from('feedback').select('*').eq('restaurant_id', restaurantId).order('created_at').retry(false)
      if (error) throw new Error(`feedback: ${error.message}`)
      return parseAll(data, parseFeedback)
    },

    async addFeedback(input: NewFeedback): Promise<ParentFeedback> {
      if (input.reporterBands.length === 0) throw new RangeError('Feedback must be tagged with at least one child age band')
      if (!Number.isFinite(input.waitMinutes) || input.waitMinutes < 0) throw new RangeError('waitMinutes must be zero or more')
      await ensureUserId() // best effort: signed-in feedback can be read back by its author later
      const id = makeId()
      const { error } = await client.from('feedback').insert(feedbackToRow(id, input)).retry(false)
      if (error) throw new Error(`feedback: ${error.message}`)
      return { ...input, id, createdAt: now().toISOString() }
    },

    async listTripLists() {
      if (!(await currentUserId())) return []
      const { data, error } = await client.from('trip_lists').select('*').order('created_at').retry(false)
      if (error) throw new Error(`trip_lists: ${error.message}`)
      return parseAll(data, parseTripList)
    },

    async saveTripList(list: TripList): Promise<TripList> {
      const userId = await ensureUserId()
      if (!userId) throw new AuthUnavailableError()
      const saved: TripList = { ...list, updatedAt: now().toISOString() }
      const { error } = await client.from('trip_lists').upsert(tripListToRow(userId, saved), { onConflict: 'user_id,id' }).retry(false)
      if (error) throw new Error(`trip_lists: ${error.message}`)
      return saved
    },

    async deleteTripList(id) {
      if (!(await currentUserId())) return
      const { error } = await client.from('trip_lists').delete().eq('id', id).retry(false)
      if (error) throw new Error(`trip_lists: ${error.message}`)
    },
  }
}
