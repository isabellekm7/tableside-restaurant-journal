import type { City, LatLng } from '../../data/types'
import { haversineKm, type TravelEstimate } from './distance'

const KM_PER_MILE = 1.609344

export const milesToKm = (miles: number): number => miles * KM_PER_MILE
export const kmToMiles = (km: number): number => km / KM_PER_MILE

/** "0.4 mi", "12 mi", or "Nearby" when it's basically next door. Sample cities are US, so miles. */
export function formatDistance(km: number): string {
  const miles = kmToMiles(km)
  if (miles < 0.1) return 'Nearby'
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`
}

/** "9 min walk" / "12 min ride". */
export function formatTravel(travel: TravelEstimate): string {
  return `${travel.minutes} min ${travel.mode}`
}

/** The supported city closest to a point, or null when the point is far from all of them. */
export function nearestCity(point: LatLng, cities: readonly City[], maxKm = 100): City | null {
  let best: { city: City; km: number } | null = null
  for (const city of cities) {
    const km = haversineKm(point, city.center)
    if (km <= maxKm && (!best || km < best.km)) best = { city, km }
  }
  return best?.city ?? null
}
