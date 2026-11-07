import type { LatLng } from '../../data/types'

const EARTH_RADIUS_KM = 6371

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

const WALK_KM_PER_H = 4.5 // slower than adult pace: strollers and small legs
const RIDE_KM_PER_H = 22 // city driving / rideshare
const RIDE_OVERHEAD_MIN = 4 // getting the family into the car

/** Straight-line distance understates street distance, so scale it up a little. */
const ROUTE_FACTOR = 1.3

export const WALKABLE_KM = 1.2

export interface TravelEstimate {
  mode: 'walk' | 'ride'
  minutes: number
}

export function walkMinutes(km: number): number {
  return Math.max(1, Math.round(((km * ROUTE_FACTOR) / WALK_KM_PER_H) * 60))
}

export function rideMinutes(km: number): number {
  return Math.max(1, Math.round(((km * ROUTE_FACTOR) / RIDE_KM_PER_H) * 60 + RIDE_OVERHEAD_MIN))
}

/** Walk when it's close enough to be reasonable with kids, otherwise ride. */
export function travelEstimate(km: number): TravelEstimate {
  return km <= WALKABLE_KM ? { mode: 'walk', minutes: walkMinutes(km) } : { mode: 'ride', minutes: rideMinutes(km) }
}
