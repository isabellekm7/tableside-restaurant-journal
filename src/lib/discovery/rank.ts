import type { Child, City, ClockTime, LatLng, Restaurant } from '../../data/types'
import { haversineKm, travelEstimate, type TravelEstimate } from '../geo/distance'
import { currentClosingTime, isOpenAt, minutesUntilClose } from '../time/hours'
import { scoreRestaurant, type KidFitResult } from '../scoring'
import type { ScoringConfig } from '../scoring/config'
import type { SortMode } from './filters'

export interface RankedRestaurant {
  restaurant: Restaurant
  fit: KidFitResult
  distanceKm: number
  travel: TravelEstimate
  open: boolean
  closesAt: ClockTime | null
  minutesUntilClose: number | null
}

export interface RankInput {
  restaurants: readonly Restaurant[]
  children: readonly Child[]
  /** Distances are measured from here: the city centre or the user's location. */
  origin: LatLng
  cities: readonly City[]
  now: Date
  /** Drop places further than this from the origin. */
  maxDistanceKm: number | null
  sort: SortMode
  config?: ScoringConfig
}

/** Open first, then known fits before "not enough info", then higher score, then nearer. */
function byFit(a: RankedRestaurant, b: RankedRestaurant): number {
  if (a.open !== b.open) return a.open ? -1 : 1
  const aUnknown = a.fit.level === 'unknown'
  const bUnknown = b.fit.level === 'unknown'
  if (aUnknown !== bUnknown) return aUnknown ? 1 : -1
  return b.fit.score - a.fit.score || a.distanceKm - b.distanceKm || a.restaurant.name.localeCompare(b.restaurant.name)
}

const byDistance = (a: RankedRestaurant, b: RankedRestaurant): number =>
  a.distanceKm - b.distanceKm || a.restaurant.name.localeCompare(b.restaurant.name)

export function sortRanked(items: readonly RankedRestaurant[], sort: SortMode): RankedRestaurant[] {
  return [...items].sort(sort === 'fit' ? byFit : byDistance)
}

/** Score, locate and sort restaurants for this family, right now. Pure. */
export function rankRestaurants(input: RankInput): RankedRestaurant[] {
  const { restaurants, children, origin, cities, now, maxDistanceKm, sort, config } = input
  const items: RankedRestaurant[] = []
  for (const restaurant of restaurants) {
    const city = cities.find((c) => c.id === restaurant.cityId)
    const distanceKm = haversineKm(origin, restaurant.location)
    if (maxDistanceKm !== null && distanceKm > maxDistanceKm) continue
    const open = city ? isOpenAt(restaurant.hours, city.timeZone, now) : false
    items.push({
      restaurant,
      fit: scoreRestaurant(restaurant, children, config),
      distanceKm,
      travel: travelEstimate(distanceKm),
      open,
      closesAt: open && city ? currentClosingTime(restaurant.hours, city.timeZone, now) : null,
      minutesUntilClose: open && city ? minutesUntilClose(restaurant.hours, city.timeZone, now) : null,
    })
  }
  return sortRanked(items, sort)
}

/** True when at least one place is a "great" or "good" fit. */
export const hasGoodFit = (items: readonly RankedRestaurant[]): boolean =>
  items.some((i) => i.fit.level === 'great' || i.fit.level === 'good')

/**
 * The best available options, for when filters leave nothing or nothing fits
 * well: top few by fit, open first. Callers pass the UNFILTERED city list.
 */
export function closestCompromises(items: readonly RankedRestaurant[], count = 3): RankedRestaurant[] {
  return sortRanked(items, 'fit').slice(0, count)
}

/**
 * Score a mixed set (e.g. a trip list spanning two cities) with each place measured from
 * ITS OWN city's centre, keeping the order given. Places whose city is unknown are skipped.
 */
export function rankInOwnCity(input: Omit<RankInput, 'origin' | 'maxDistanceKm' | 'sort'>): RankedRestaurant[] {
  const items: RankedRestaurant[] = []
  for (const restaurant of input.restaurants) {
    const city = input.cities.find((c) => c.id === restaurant.cityId)
    if (!city) continue
    const [item] = rankRestaurants({ ...input, restaurants: [restaurant], origin: city.center, maxDistanceKm: null, sort: 'fit' })
    if (item) items.push(item)
  }
  return items
}
