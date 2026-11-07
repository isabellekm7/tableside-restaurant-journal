import { describe, expect, it, vi } from 'vitest'
import { createMemoryStore } from './keyValueStore'
import { createLocalRepository } from './localRepository'
import type { RestaurantRepository } from './repository'
import { createResilientRepository, mergeTripLists } from './resilientRepository'
import type { NewFeedback, TripList } from './types'

const NOW = new Date('2026-11-07T19:00:00Z')

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

const list = (id: string, updatedAt: string, createdAt = '2026-11-01T00:00:00Z'): TripList => ({ id, name: id, restaurantIds: [], createdAt, updatedAt })

/** A remote repository that can be switched between healthy and down. */
function fakeRemote(local: RestaurantRepository) {
  const state = { down: false, lists: [] as TripList[], feedback: [] as unknown[] }
  const guard = <T>(fn: () => Promise<T>) => async (): Promise<T> => {
    if (state.down) throw new Error('network down')
    return fn()
  }
  const remote: RestaurantRepository = {
    listCities: guard(() => local.listCities()),
    listCuisines: (c) => guard(() => local.listCuisines(c))(),
    listRestaurants: (q) => guard(() => local.listRestaurants(q))(),
    getRestaurant: (id) => guard(() => local.getRestaurant(id))(),
    findNearby: (o, opts) => guard(() => local.findNearby(o, opts))(),
    getWait: (id, at) => guard(() => local.getWait(id, at))(),
    listFeedback: guard(async () => []),
    addFeedback: (input) =>
      guard(async () => {
        state.feedback.push(input)
        return { ...input, id: 'remote-1', createdAt: NOW.toISOString() }
      })(),
    listTripLists: guard(async () => [...state.lists]),
    saveTripList: (l) =>
      guard(async () => {
        const saved = { ...l, updatedAt: '2026-11-07T19:00:00.000Z' }
        state.lists = [...state.lists.filter((x) => x.id !== l.id), saved]
        return saved
      })(),
    deleteTripList: (id) =>
      guard(async () => {
        state.lists = state.lists.filter((l) => l.id !== id)
      })(),
  }
  return { remote, state }
}

function setup() {
  const local = createLocalRepository({ store: createMemoryStore(), now: () => NOW })
  const bundled = createLocalRepository() // stands in for the remote's data in the fake
  const { remote, state } = fakeRemote(bundled)
  const onFallback = vi.fn()
  return { repo: createResilientRepository({ remote, local, onFallback }), local, state, onFallback }
}

describe('catalog fallback', () => {
  it('uses the backend when it is healthy', async () => {
    const { repo, onFallback } = setup()
    expect(await repo.listRestaurants()).toHaveLength(28)
    expect(onFallback).not.toHaveBeenCalled()
  })

  it('keeps the whole app working from on-device data when the backend is down', async () => {
    const { repo, state, onFallback } = setup()
    state.down = true
    expect(await repo.listRestaurants({ cityId: 'chicago' })).toHaveLength(14)
    expect((await repo.getRestaurant('pdx-velvet-ladle'))?.name).toBe('The Velvet Ladle')
    expect(await repo.listCities()).toHaveLength(2)
    expect(onFallback).toHaveBeenCalledWith('listRestaurants', expect.any(Error))
  })
})

describe('feedback', () => {
  it('keeps a local copy of what the backend accepted, so the author can see "their" report', async () => {
    const { repo, local } = setup()
    const saved = await repo.addFeedback(feedback)
    expect(saved.id).toBe('remote-1')
    expect(await local.listFeedback('pdx-little-fern-kitchen')).toEqual([saved])
    expect(await repo.listFeedback('pdx-little-fern-kitchen')).toEqual([saved]) // not duplicated
  })

  it('saves on the device when the backend is down instead of losing the report', async () => {
    const { repo, state } = setup()
    state.down = true
    const saved = await repo.addFeedback(feedback)
    expect(saved.id).not.toBe('remote-1')
    expect(await repo.listFeedback('pdx-little-fern-kitchen')).toHaveLength(1)
  })

  it('does not mask invalid input as an outage', async () => {
    const { repo, onFallback } = setup()
    const invalid = createResilientRepository({
      local: createLocalRepository(),
      remote: { ...fakeRemote(createLocalRepository()).remote, addFeedback: () => Promise.reject(new RangeError('bad input')) },
      onFallback,
    })
    await expect(invalid.addFeedback(feedback)).rejects.toThrow(RangeError)
    expect(onFallback).not.toHaveBeenCalled()
    expect(repo).toBeDefined()
  })
})

describe('trip lists: device first, backend best-effort', () => {
  it('saves to both when online, and returns the backend’s copy', async () => {
    const { repo, local, state } = setup()
    const saved = await repo.saveTripList(list('a', '2026-11-01T00:00:00Z'))
    expect(state.lists.map((l) => l.id)).toEqual(['a'])
    expect((await local.listTripLists())[0]?.updatedAt).toBe(saved.updatedAt)
  })

  it('works offline, then pushes the list to the backend on the next read', async () => {
    const { repo, state, onFallback } = setup()
    state.down = true
    await repo.saveTripList(list('offline', '2026-11-01T00:00:00Z'))
    expect(await repo.listTripLists()).toHaveLength(1) // available offline
    expect(onFallback).toHaveBeenCalled()

    state.down = false
    expect((await repo.listTripLists()).map((l) => l.id)).toEqual(['offline'])
    expect(state.lists.map((l) => l.id)).toEqual(['offline']) // synced
  })

  it('merges lists from both sides, newest copy winning', async () => {
    const { repo, state, local } = setup()
    state.lists = [list('remote-only', '2026-11-02T00:00:00Z'), list('both', '2026-11-03T00:00:00Z')]
    local.rememberTripList(list('both', '2026-11-01T00:00:00Z')) // older locally
    local.rememberTripList(list('local-only', '2026-11-04T00:00:00Z'))

    const ids = (await repo.listTripLists()).map((l) => l.id).sort()
    expect(ids).toEqual(['both', 'local-only', 'remote-only'])
    expect(state.lists.map((l) => l.id).sort()).toEqual(['both', 'local-only', 'remote-only'])
  })

  it('deletes on the device even when the backend is down', async () => {
    const { repo, state, local } = setup()
    await repo.saveTripList(list('a', '2026-11-01T00:00:00Z'))
    state.down = true
    await repo.deleteTripList('a')
    expect(await local.listTripLists()).toEqual([])
  })
})

describe('mergeTripLists', () => {
  it('prefers the newer copy and reports which local lists the backend has not seen', () => {
    const remote = [list('x', '2026-11-05T00:00:00Z'), list('y', '2026-11-01T00:00:00Z')]
    const local = [list('x', '2026-11-04T00:00:00Z'), list('y', '2026-11-06T00:00:00Z'), list('z', '2026-11-02T00:00:00Z')]
    const { merged, localNewer } = mergeTripLists(remote, local)
    expect(Object.fromEntries(merged.map((l) => [l.id, l.updatedAt]))).toEqual({
      x: '2026-11-05T00:00:00Z',
      y: '2026-11-06T00:00:00Z',
      z: '2026-11-02T00:00:00Z',
    })
    expect(localNewer.map((l) => l.id).sort()).toEqual(['y', 'z'])
  })
})
