import { useEffect, useState } from 'react'
import { repository, type City, type CityId, type Restaurant, type WaitEstimate } from '../../data'
import { loadWaits } from '../shared/loadWaits'

export type RightNowData =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; cities: City[]; restaurants: Restaurant[]; waits: Map<string, WaitEstimate | null> }

/**
 * Everything "Right now" needs for a city: its restaurants and a current wait estimate
 * for each (via the repository, so a real wait source drops in without changes here).
 * Re-fetches each minute so "open now" and waits stay honest.
 */
export function useRightNowData(cityId: CityId, now: Date): { data: RightNowData; retry: () => void } {
  const [data, setData] = useState<RightNowData>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const minute = Math.floor(now.getTime() / 60_000)

  useEffect(() => {
    let cancelled = false
    const at = new Date(minute * 60_000)
    void (async () => {
      try {
        const [cities, restaurants] = await Promise.all([repository.listCities(), repository.listRestaurants({ cityId })])
        const waits = await loadWaits(restaurants, at)
        if (!cancelled) setData({ status: 'ready', cities, restaurants, waits })
      } catch {
        if (!cancelled) setData({ status: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cityId, minute, attempt])

  return {
    data,
    retry: () => {
      setData({ status: 'loading' })
      setAttempt((n) => n + 1)
    },
  }
}
