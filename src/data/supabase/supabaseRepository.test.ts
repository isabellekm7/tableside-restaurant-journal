import { createClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalRepository } from '../localRepository'
import type { RestaurantQuery } from '../repository'
import type { NewFeedback, TripList } from '../types'
import { allRestaurantRows, cityRows } from './fixtures'
import { AuthUnavailableError, createSupabaseRepository } from './supabaseRepository'

// Saturday 2026-11-07, 11:00 in Portland.
const SATURDAY_MIDDAY = new Date('2026-11-07T19:00:00Z')

interface Call {
  method: string
  path: string
  search: string
  headers: Headers
  body: unknown
}

interface World {
  calls: Call[]
  /** Set false to make every request fail with a network error. */
  online: boolean
  anonymousSignInWorks: boolean
  catalog: { cities: unknown[]; restaurants: unknown[] }
  feedbackError: string | null
  tripLists: unknown[]
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const session = (expiresAt: number) => ({
  access_token: 'access.token.value',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: expiresAt,
  refresh_token: 'refresh-token',
  user: { id: 'user-1', aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: '2026-11-07T00:00:00Z' },
})

function setup(overrides: Partial<World> = {}) {
  const world: World = {
    calls: [],
    online: true,
    anonymousSignInWorks: true,
    catalog: { cities: cityRows(), restaurants: allRestaurantRows() },
    feedbackError: null,
    tripLists: [],
    ...overrides,
  }
  let clock = SATURDAY_MIDDAY.getTime()

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const method = init?.method ?? 'GET'
    const raw = typeof init?.body === 'string' ? init.body : null
    world.calls.push({ method, path: url.pathname, search: url.search, headers: new Headers(init?.headers), body: raw ? JSON.parse(raw) : null })
    if (!world.online) throw new TypeError('Failed to fetch')

    if (url.pathname === '/auth/v1/signup') {
      return world.anonymousSignInWorks
        ? json(session(Math.floor(clock / 1000) + 3600))
        : json({ code: 'anonymous_provider_disabled', msg: 'Anonymous sign-ins are disabled' }, 422)
    }
    if (url.pathname === '/rest/v1/cities') return json(world.catalog.cities)
    if (url.pathname === '/rest/v1/restaurants') return json(world.catalog.restaurants)
    if (url.pathname === '/rest/v1/feedback' && method === 'POST') {
      return world.feedbackError ? json({ code: '42501', message: world.feedbackError }, 403) : new Response(null, { status: 201 })
    }
    if (url.pathname === '/rest/v1/trip_lists') {
      if (method === 'GET') return json(world.tripLists)
      return new Response(null, { status: method === 'DELETE' ? 204 : 201 })
    }
    return json({ message: `unexpected ${method} ${url.pathname}` }, 404)
  })

  const client = createClient('https://test.supabase.co', 'sb_publishable_test', {
    global: { fetch: fetchMock },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const repo = createSupabaseRepository(client, { now: () => new Date(clock), makeId: () => 'generated-id', catalogTtlMs: 60_000 })
  const calls = (path: string, method = 'GET') => world.calls.filter((c) => c.path === path && c.method === method)
  return { repo, world, calls, advance: (ms: number) => (clock += ms) }
}

const feedback: NewFeedback = {
  restaurantId: 'pdx-little-fern-kitchen',
  reporterBands: ['toddler'],
  hadHighChair: 'yes',
  staffWelcoming: 'yes',
  waitMinutes: 10,
  noise: 'loud',
  wouldReturn: true,
  notForUs: false,
}

const list: TripList = { id: 'trip-1', name: 'Portland weekend', restaurantIds: ['pdx-little-fern-kitchen'], createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z' }

describe('catalog', () => {
  it('loads all restaurants with their facts in a single round trip, then serves from cache', async () => {
    const { repo, calls } = setup()
    expect(await repo.listRestaurants()).toHaveLength(28)
    await repo.getRestaurant('pdx-velvet-ladle')
    await repo.listCities()
    await repo.listCuisines()
    expect(calls('/rest/v1/restaurants')).toHaveLength(1)
    expect(calls('/rest/v1/cities')).toHaveLength(1)
    expect(decodeURIComponent(calls('/rest/v1/restaurants')[0]?.search ?? '')).toContain('restaurant_attributes(*)')
  })

  it('sends only the public key (no user session is needed to read)', async () => {
    const { repo, calls } = setup()
    await repo.listRestaurants()
    expect(calls('/rest/v1/restaurants')[0]?.headers.get('apikey')).toBe('sb_publishable_test')
  })

  it('shares one in-flight request between simultaneous callers', async () => {
    const { repo, calls } = setup()
    await Promise.all([repo.listRestaurants(), repo.listCities(), repo.getRestaurant('pdx-velvet-ladle')])
    expect(calls('/rest/v1/restaurants')).toHaveLength(1)
  })

  const queries: Array<[string, RestaurantQuery]> = [
    ['city', { cityId: 'chicago' }],
    ['price', { maxPriceLevel: 1 }],
    ['text', { text: 'pizza' }],
    ['cuisine', { cuisines: ['Ramen'] }],
    ['dietary', { dietary: ['nutAllergyAware'] }],
    ['open now', { cityId: 'portland', openAt: SATURDAY_MIDDAY }],
    ['combined', { cityId: 'portland', maxPriceLevel: 2, dietary: ['glutenFree'], openAt: SATURDAY_MIDDAY }],
  ]
  it.each(queries)('filters exactly like the on-device data does: %s', async (_name, query) => {
    const { repo } = setup()
    const local = createLocalRepository()
    expect((await repo.listRestaurants(query)).map((r) => r.id)).toEqual((await local.listRestaurants(query)).map((r) => r.id))
  })

  it('finds nearby places and simulates waits like the local repository', async () => {
    const { repo } = setup()
    const nearby = await repo.findNearby({ lat: 45.5231, lng: -122.6765 }, { cityId: 'portland', limit: 3 })
    expect(nearby).toHaveLength(3)
    expect(nearby[0]?.restaurant.id).toBe('pdx-marlow-finch-bistro')
    expect((await repo.getWait('pdx-little-fern-kitchen'))?.source).toBe('simulated')
    expect(await repo.getWait('nope')).toBeNull()
  })

  it('refreshes after the cache expires, and serves the stale catalog if the refresh fails', async () => {
    const { repo, world, calls, advance } = setup()
    await repo.listRestaurants()
    advance(61_000)
    await repo.listRestaurants()
    expect(calls('/rest/v1/restaurants')).toHaveLength(2)

    advance(61_000)
    world.online = false
    expect(await repo.listRestaurants()).toHaveLength(28) // stale, not an error
  })

  it('fails loudly on an HTTP error, an empty catalog, or a catalog of garbage', async () => {
    await expect(setup({ online: false }).repo.listRestaurants()).rejects.toThrow()
    await expect(setup({ catalog: { cities: cityRows(), restaurants: [] } }).repo.listRestaurants()).rejects.toThrow(/empty/)
    await expect(setup({ catalog: { cities: cityRows(), restaurants: [{ junk: 1 }] } }).repo.listRestaurants()).rejects.toThrow(/empty|unexpected/)
  })

  it('skips individual bad rows but serves the rest', async () => {
    const rows = allRestaurantRows()
    const { repo } = setup({ catalog: { cities: cityRows(), restaurants: [...rows, { id: 'broken' }] } })
    expect(await repo.listRestaurants()).toHaveLength(28)
  })
})

describe('feedback', () => {
  let ctx: ReturnType<typeof setup>
  beforeEach(() => {
    ctx = setup()
  })

  it('signs the device in anonymously once, then inserts snake_case rows as that user', async () => {
    const saved = await ctx.repo.addFeedback(feedback)
    await ctx.repo.addFeedback(feedback)

    expect(ctx.calls('/auth/v1/signup', 'POST')).toHaveLength(1)
    const insert = ctx.calls('/rest/v1/feedback', 'POST')[0]
    expect(insert?.headers.get('authorization')).toBe('Bearer access.token.value')
    expect(insert?.body).toEqual({
      id: 'generated-id', restaurant_id: 'pdx-little-fern-kitchen', reporter_bands: ['toddler'], had_high_chair: 'yes',
      staff_welcoming: 'yes', wait_minutes: 10, noise: 'loud', would_return: true, not_for_us: false,
    })
    expect(saved).toMatchObject({ id: 'generated-id', restaurantId: 'pdx-little-fern-kitchen', reporterBands: ['toddler'] })
  })

  it('does not send user_id: the database fills it from the session, so it cannot be spoofed', async () => {
    await ctx.repo.addFeedback(feedback)
    expect(Object.keys(ctx.calls('/rest/v1/feedback', 'POST')[0]?.body as object)).not.toContain('user_id')
  })

  it('still submits anonymously if anonymous sign-in is switched off', async () => {
    const off = setup({ anonymousSignInWorks: false })
    await off.repo.addFeedback(feedback)
    const insert = off.calls('/rest/v1/feedback', 'POST')[0]
    expect(insert?.headers.get('authorization')).toBe('Bearer sb_publishable_test') // plain anon role
  })

  it('does not hammer the sign-in endpoint when it is disabled', async () => {
    const off = setup({ anonymousSignInWorks: false })
    await off.repo.addFeedback(feedback)
    await off.repo.addFeedback(feedback)
    expect(off.calls('/auth/v1/signup', 'POST')).toHaveLength(1)
  })

  it('rejects invalid input before touching the network', async () => {
    await expect(ctx.repo.addFeedback({ ...feedback, reporterBands: [] })).rejects.toThrow(RangeError)
    await expect(ctx.repo.addFeedback({ ...feedback, waitMinutes: -1 })).rejects.toThrow(RangeError)
    expect(ctx.world.calls).toHaveLength(0)
  })

  it('surfaces server-side rejections', async () => {
    ctx.world.feedbackError = 'new row violates row-level security policy'
    await expect(ctx.repo.addFeedback(feedback)).rejects.toThrow(/row-level security/)
  })

  it('cannot read feedback back without a session (by design)', async () => {
    expect(await ctx.repo.listFeedback('pdx-little-fern-kitchen')).toEqual([])
    expect(ctx.world.calls).toHaveLength(0)
  })
})

describe('trip lists', () => {
  it('without a session, lists read as empty and nothing is requested', async () => {
    const { repo, world } = setup()
    expect(await repo.listTripLists()).toEqual([])
    await repo.deleteTripList('trip-1')
    expect(world.calls).toHaveLength(0)
  })

  it('saving signs in and upserts a row owned by the anonymous user', async () => {
    const { repo, calls, advance } = setup()
    advance(5000)
    const saved = await repo.saveTripList(list)
    const call = calls('/rest/v1/trip_lists', 'POST')[0]
    expect(call?.search).toContain('on_conflict=user_id%2Cid')
    expect(call?.body).toMatchObject({ user_id: 'user-1', id: 'trip-1', name: 'Portland weekend', restaurant_ids: ['pdx-little-fern-kitchen'] })
    expect(saved.updatedAt).toBe(new Date(SATURDAY_MIDDAY.getTime() + 5000).toISOString())
  })

  it('after signing in, lists can be read and deleted', async () => {
    const { repo, world, calls } = setup()
    await repo.saveTripList(list)
    world.tripLists = [{ user_id: 'user-1', id: 'trip-1', name: 'Portland weekend', restaurant_ids: ['a'], created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-02T00:00:00Z' }]
    expect(await repo.listTripLists()).toMatchObject([{ id: 'trip-1', restaurantIds: ['a'] }])
    await repo.deleteTripList('trip-1')
    expect(calls('/rest/v1/trip_lists', 'DELETE')).toHaveLength(1)
    expect(calls('/rest/v1/trip_lists', 'DELETE')[0]?.search).toContain('id=eq.trip-1')
  })

  it('reports clearly when saving is impossible because anonymous sign-in is off', async () => {
    const { repo } = setup({ anonymousSignInWorks: false })
    await expect(repo.saveTripList(list)).rejects.toBeInstanceOf(AuthUnavailableError)
  })
})
