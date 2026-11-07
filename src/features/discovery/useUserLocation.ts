import { useCallback, useState } from 'react'
import type { City } from '../../data'
import { track } from '../../lib/analytics/logger'
import { nearestCity } from '../../lib/geo/format'
import { useDiscoveryStore } from '../../store/discoveryStore'

export type LocationStatus =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'ok'; city: City }
  /** Located, but not near any city we have sample data for. */
  | { kind: 'outside' }
  | { kind: 'denied' }
  | { kind: 'unavailable' }

/**
 * "Use my location" with graceful fallbacks: every failure leaves the app
 * working from the chosen city's centre. Coordinates are used once to pick a
 * city and measure distances; they are never stored or logged.
 */
export function useUserLocation(cities: readonly City[]) {
  const [status, setStatus] = useState<LocationStatus>({ kind: 'idle' })
  const setCity = useDiscoveryStore((s) => s.setCity)
  const setOrigin = useDiscoveryStore((s) => s.setOrigin)

  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus({ kind: 'unavailable' })
      track({ type: 'location_requested', outcome: 'unavailable' })
      return
    }
    setStatus({ kind: 'locating' })
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude }
        const city = nearestCity(point, cities)
        if (city) {
          setCity(city.id)
          setOrigin({ kind: 'geo', point })
          setStatus({ kind: 'ok', city })
          track({ type: 'location_requested', outcome: 'ok' })
        } else {
          setStatus({ kind: 'outside' })
          track({ type: 'location_requested', outcome: 'outside_sample_cities' })
        }
      },
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED
        setStatus({ kind: denied ? 'denied' : 'unavailable' })
        track({ type: 'location_requested', outcome: denied ? 'denied' : 'unavailable' })
      },
      { timeout: 8000, maximumAge: 5 * 60_000 },
    )
  }, [cities, setCity, setOrigin])

  const reset = useCallback(() => setStatus({ kind: 'idle' }), [])

  return { status, request, reset }
}
