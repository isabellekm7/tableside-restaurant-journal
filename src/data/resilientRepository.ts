import type { LocalRepository } from './localRepository'
import type { RestaurantRepository } from './repository'
import type { TripList } from './types'

export interface ResilientOptions {
  remote: RestaurantRepository
  local: LocalRepository
  /** Called when a remote call failed and the local copy was used instead. */
  onFallback?: (operation: string, error: unknown) => void
}

/** Newest copy of each list wins. `localNewer` are the ones the backend should be told about. */
export function mergeTripLists(remote: readonly TripList[], local: readonly TripList[]): { merged: TripList[]; localNewer: TripList[] } {
  const byId = new Map<string, TripList>(remote.map((l) => [l.id, l]))
  const localNewer: TripList[] = []
  for (const list of local) {
    const other = byId.get(list.id)
    if (!other || list.updatedAt > other.updatedAt) {
      byId.set(list.id, list)
      localNewer.push(list)
    }
  }
  return { merged: [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), localNewer }
}

/**
 * Backend first, device always.
 *
 * - Catalog reads: remote; if it fails (offline, outage, misconfiguration), the bundled
 *   sample data keeps the app fully usable.
 * - Feedback and trip lists: saved on the device first (so they work offline), then sent
 *   to the backend best-effort. Anything saved offline is pushed on the next read.
 *
 * Known limitation: a list deleted while offline can reappear from the backend later.
 */
export function createResilientRepository({ remote, local, onFallback }: ResilientOptions): RestaurantRepository {
  async function withFallback<T>(operation: string, run: (repo: RestaurantRepository) => Promise<T>): Promise<T> {
    try {
      return await run(remote)
    } catch (error) {
      onFallback?.(operation, error)
      return run(local)
    }
  }

  return {
    listCities: () => withFallback('listCities', (r) => r.listCities()),
    listCuisines: (cityId) => withFallback('listCuisines', (r) => r.listCuisines(cityId)),
    listRestaurants: (query) => withFallback('listRestaurants', (r) => r.listRestaurants(query)),
    getRestaurant: (id) => withFallback('getRestaurant', (r) => r.getRestaurant(id)),
    findNearby: (origin, options) => withFallback('findNearby', (r) => r.findNearby(origin, options)),
    getWait: (id, at) => withFallback('getWait', (r) => r.getWait(id, at)),

    async addFeedback(input) {
      try {
        const saved = await remote.addFeedback(input)
        local.rememberFeedback(saved) // keep the author's own copy for "includes your report"
        return saved
      } catch (error) {
        if (error instanceof RangeError) throw error // invalid input is the caller's bug, not an outage
        onFallback?.('addFeedback', error)
        return local.addFeedback(input)
      }
    },

    async listFeedback(restaurantId) {
      const own = await local.listFeedback(restaurantId)
      try {
        const remoteOwn = await remote.listFeedback(restaurantId)
        const known = new Set(own.map((f) => f.id))
        return [...own, ...remoteOwn.filter((f) => !known.has(f.id))].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      } catch (error) {
        onFallback?.('listFeedback', error)
        return own
      }
    },

    async listTripLists() {
      const localLists = await local.listTripLists()
      let remoteLists: TripList[]
      try {
        remoteLists = await remote.listTripLists()
      } catch (error) {
        onFallback?.('listTripLists', error)
        return localLists
      }
      const { merged, localNewer } = mergeTripLists(remoteLists, localLists)
      // Tell the backend about anything made or changed on this device while it was away.
      const pushed = await Promise.allSettled(localNewer.map((l) => remote.saveTripList(l)))
      const synced = new Map<string, TripList>()
      pushed.forEach((result, i) => {
        const original = localNewer[i]
        if (original && result.status === 'fulfilled') synced.set(original.id, result.value)
      })
      const result = merged.map((l) => synced.get(l.id) ?? l)
      for (const list of result) local.rememberTripList(list)
      return result
    },

    async saveTripList(list) {
      const saved = await local.saveTripList(list) // device first: works offline
      try {
        const remoteSaved = await remote.saveTripList(saved)
        local.rememberTripList(remoteSaved)
        return remoteSaved
      } catch (error) {
        onFallback?.('saveTripList', error)
        return saved
      }
    },

    async deleteTripList(id) {
      await local.deleteTripList(id)
      try {
        await remote.deleteTripList(id)
      } catch (error) {
        onFallback?.('deleteTripList', error)
      }
    },
  }
}
