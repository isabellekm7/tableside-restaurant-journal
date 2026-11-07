import { useEffect, useState } from 'react'
import { repository, type Child, type City, type Restaurant } from '../../data'
import { findBailOutOptions, type BailOutResult } from '../../lib/bailout/findAlternative'
import { rankRestaurants } from '../../lib/discovery/rank'
import { loadWaits } from '../shared/loadWaits'

export type BailOutState = { status: 'loading' | 'error' } | { status: 'ready'; result: BailOutResult }

/**
 * Finds the nearest quick alternative to `restaurant`. Distances are measured from
 * that restaurant (where the family is), not from the city centre. Mount it only
 * while the bail-out sheet is open, so each opening starts fresh.
 */
export function useBailOut(input: { restaurant: Restaurant; city: City; children: readonly Child[] }): { state: BailOutState; retry: () => void } {
  const { restaurant, city, children } = input
  const [state, setState] = useState<BailOutState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const now = new Date()
        const restaurants = await repository.listRestaurants({ cityId: restaurant.cityId })
        const waits = await loadWaits(restaurants, now)
        const ranked = rankRestaurants({
          restaurants,
          children,
          origin: restaurant.location,
          cities: [city],
          now,
          maxDistanceKm: null,
          sort: 'distance',
        })
        const candidates = ranked.map((item) => ({ item, wait: waits.get(item.restaurant.id) ?? null }))
        if (!cancelled) setState({ status: 'ready', result: findBailOutOptions({ currentId: restaurant.id, candidates }) })
      } catch {
        if (!cancelled) setState({ status: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [restaurant, city, children, attempt])

  return {
    state,
    retry: () => {
      setState({ status: 'loading' })
      setAttempt((n) => n + 1)
    },
  }
}
