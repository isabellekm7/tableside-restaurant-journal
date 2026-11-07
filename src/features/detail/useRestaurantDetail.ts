import { useEffect, useState } from 'react'
import { repository, type City, type Restaurant, type WaitEstimate } from '../../data'

export type DetailData =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'notFound' }
  | { status: 'ready'; restaurant: Restaurant; city: City; wait: WaitEstimate | null }

/** Loads one restaurant (plus its city and a wait estimate) through the repository. */
export function useRestaurantDetail(id: string): { data: DetailData; retry: () => void } {
  const [state, setState] = useState<{ forId: string; data: DetailData }>({ forId: id, data: { status: 'loading' } })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [restaurant, cities] = await Promise.all([repository.getRestaurant(id), repository.listCities()])
        if (cancelled) return
        if (!restaurant) return setState({ forId: id, data: { status: 'notFound' } })
        const city = cities.find((c) => c.id === restaurant.cityId)
        if (!city) return setState({ forId: id, data: { status: 'error' } })
        const wait = await repository.getWait(id, new Date()).catch(() => null)
        if (!cancelled) setState({ forId: id, data: { status: 'ready', restaurant, city, wait } })
      } catch {
        if (!cancelled) setState({ forId: id, data: { status: 'error' } })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, attempt])

  return {
    // A stale result for a previous restaurant is never shown for the new one.
    data: state.forId === id ? state.data : { status: 'loading' },
    retry: () => {
      setState({ forId: id, data: { status: 'loading' } })
      setAttempt((n) => n + 1)
    },
  }
}
