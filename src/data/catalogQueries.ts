import { haversineKm } from '../lib/geo/distance'
import { isOpenAt } from '../lib/time/hours'
import type { NearbyOptions, NearbyResult, RestaurantQuery } from './repository'
import type { City, LatLng, Restaurant } from './types'

/*
 * Pure catalog queries over an in-memory list. Every repository whose catalog
 * is small enough to hold in memory (the bundled sample data, and the Supabase
 * catalog) shares this, so filtering behaves identically whatever the source.
 */

function matchesQuery(r: Restaurant, q: RestaurantQuery, cities: readonly City[]): boolean {
  if (q.cityId && r.cityId !== q.cityId) return false
  if (q.maxPriceLevel !== undefined && r.priceLevel > q.maxPriceLevel) return false
  if (q.cuisines?.length && !q.cuisines.includes(r.cuisine)) return false
  if (q.dietary?.length && !q.dietary.every((tag) => r.dietary[tag]?.value === true)) return false
  const text = q.text?.trim().toLowerCase()
  if (text && !`${r.name} ${r.cuisine} ${r.neighborhood}`.toLowerCase().includes(text)) return false
  if (q.openAt) {
    const city = cities.find((c) => c.id === r.cityId)
    if (!city || !isOpenAt(r.hours, city.timeZone, q.openAt)) return false
  }
  return true
}

const byName = (a: Restaurant, b: Restaurant) => a.name.localeCompare(b.name)

export function filterRestaurants(restaurants: readonly Restaurant[], cities: readonly City[], query: RestaurantQuery = {}): Restaurant[] {
  return restaurants.filter((r) => matchesQuery(r, query, cities)).sort(byName)
}

export function listCuisines(restaurants: readonly Restaurant[], cityId?: string): string[] {
  const names = restaurants.filter((r) => !cityId || r.cityId === cityId).map((r) => r.cuisine)
  return [...new Set(names)].sort((a, b) => a.localeCompare(b))
}

export function findNearby(
  restaurants: readonly Restaurant[],
  cities: readonly City[],
  origin: LatLng,
  options: NearbyOptions = {},
): NearbyResult[] {
  const results = restaurants
    .filter((r) => matchesQuery(r, { cityId: options.cityId, openAt: options.openAt }, cities))
    .map((restaurant) => ({ restaurant, distanceKm: haversineKm(origin, restaurant.location) }))
    .filter((r) => options.maxKm === undefined || r.distanceKm <= options.maxKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
  return options.limit === undefined ? results : results.slice(0, options.limit)
}
