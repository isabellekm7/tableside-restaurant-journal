import { useEffect, useMemo, useState } from 'react'
import { repository, type City, type Restaurant } from '../../data'

export type ListRestaurantsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; cities: City[]; restaurants: Restaurant[]; missingIds: string[] }

/** Loads the restaurants for a list of ids, in order, through the repository (so it works offline too). */
export function useListRestaurants(ids: readonly string[]): { state: ListRestaurantsState; retry: () => void } {
  const key = useMemo(() => ids.join('|'), [ids])
  const [state, setState] = useState<{ key: string; value: ListRestaurantsState }>({ key, value: { status: 'loading' } })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const wanted = key ? key.split('|') : []
    void (async () => {
      try {
        const [cities, found] = await Promise.all([repository.listCities(), Promise.all(wanted.map((id) => repository.getRestaurant(id)))])
        if (cancelled) return
        const restaurants = found.filter((r): r is Restaurant => r !== null)
        const have = new Set(restaurants.map((r) => r.id))
        setState({ key, value: { status: 'ready', cities, restaurants, missingIds: wanted.filter((id) => !have.has(id)) } })
      } catch {
        if (!cancelled) setState({ key, value: { status: 'error' } })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key, attempt])

  return {
    // Never show a previous list's places under a new list's name.
    state: state.key === key ? state.value : { status: 'loading' },
    retry: () => {
      setState({ key, value: { status: 'loading' } })
      setAttempt((n) => n + 1)
    },
  }
}
