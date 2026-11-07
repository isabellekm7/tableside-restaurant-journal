import { useEffect, useState } from 'react'
import { repository, type City, type CityId, type Restaurant } from '../../data'
import { toRepositoryQuery, type Filters } from '../../lib/discovery/filters'

export type DiscoveryData =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready'
      cities: City[]
      cuisines: string[]
      /** Restaurants matching the repository-level filters (city, text, price, cuisine, dietary, open now). */
      filtered: Restaurant[]
      /** Every restaurant in the city, for "closest compromise" when filters are too tight. */
      all: Restaurant[]
    }

interface Query {
  cityId: CityId
  search: string
  filters: Filters
  now: Date
}

/**
 * Loads discovery data through the repository (never the seed directly).
 * Keeps showing the previous results while a new query loads, so filtering
 * doesn't flash skeletons. `retry` re-runs after an error.
 */
export function useDiscoveryData({ cityId, search, filters, now }: Query): { data: DiscoveryData; retry: () => void } {
  const [data, setData] = useState<DiscoveryData>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  // "Open now" only needs to re-query when the minute changes.
  const openMinute = filters.openNow ? Math.floor(now.getTime() / 60_000) : 0

  useEffect(() => {
    let cancelled = false
    const queryNow = filters.openNow ? new Date(openMinute * 60_000) : now
    Promise.all([
      repository.listCities(),
      repository.listCuisines(cityId),
      repository.listRestaurants(toRepositoryQuery({ cityId, search, filters, now: queryNow })),
      repository.listRestaurants({ cityId }),
    ])
      .then(([cities, cuisines, filtered, all]) => {
        if (!cancelled) setData({ status: 'ready', cities, cuisines, filtered, all })
      })
      .catch(() => {
        if (!cancelled) setData({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
    // `now` is intentionally represented by openMinute above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId, search, filters, openMinute, attempt])

  return {
    data,
    retry: () => {
      setData({ status: 'loading' })
      setAttempt((n) => n + 1)
    },
  }
}
