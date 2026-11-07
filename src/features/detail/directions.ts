import type { Restaurant } from '../../data'

/**
 * A universal "directions" link (opens the maps app on phones). The sample restaurants
 * are fictional, so this points at the sample coordinates, which sit in a real
 * neighbourhood; the page says so.
 */
export function directionsUrl(restaurant: Pick<Restaurant, 'location'>): string {
  const { lat, lng } = restaurant.location
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}
