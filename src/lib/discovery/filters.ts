import type { CityId, DietaryTag, PriceLevel } from '../../data/types'
import type { RestaurantQuery } from '../../data/repository'
import { milesToKm } from '../geo/format'

export type SortMode = 'fit' | 'distance'

export interface Filters {
  openNow: boolean
  /** Show only places at or under this price level. */
  maxPrice: PriceLevel | null
  /** Show only places within this many MILES of the origin. */
  maxDistanceMiles: number | null
  cuisines: string[]
  /** Parents report these options (never a safety guarantee). */
  dietary: DietaryTag[]
}

export const DEFAULT_FILTERS: Filters = {
  openNow: false,
  maxPrice: null,
  maxDistanceMiles: null,
  cuisines: [],
  dietary: [],
}

export const DISTANCE_OPTIONS_MILES = [0.5, 1, 2, 5] as const

export const PRICE_LABELS: Record<PriceLevel, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' }

export const SORT_LABELS: Record<SortMode, string> = {
  fit: 'Best fit, open first',
  distance: 'Nearest first',
}

/** How many filters are narrowing the results (the search box is separate). */
export function activeFilterCount(filters: Filters): number {
  return (
    (filters.openNow ? 1 : 0) +
    (filters.maxPrice !== null ? 1 : 0) +
    (filters.maxDistanceMiles !== null ? 1 : 0) +
    filters.cuisines.length +
    filters.dietary.length
  )
}

/** Filters the repository can apply. Distance is applied after ranking, from the chosen origin. */
export function toRepositoryQuery(input: { cityId: CityId; search: string; filters: Filters; now: Date }): RestaurantQuery {
  const { cityId, search, filters, now } = input
  return {
    cityId,
    ...(search.trim() && { text: search.trim() }),
    ...(filters.maxPrice !== null && { maxPriceLevel: filters.maxPrice }),
    ...(filters.cuisines.length > 0 && { cuisines: filters.cuisines }),
    ...(filters.dietary.length > 0 && { dietary: filters.dietary }),
    ...(filters.openNow && { openAt: now }),
  }
}

export const maxDistanceKm = (filters: Filters): number | null =>
  filters.maxDistanceMiles === null ? null : milesToKm(filters.maxDistanceMiles)
