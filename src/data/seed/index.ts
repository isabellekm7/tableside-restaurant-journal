import type { Restaurant } from '../types'
import { chicagoRestaurants } from './chicago'
import { portlandRestaurants } from './portland'

export { CITIES } from './cities'

/** All fictional sample restaurants. Only the repository should import this. */
export const SEED_RESTAURANTS: readonly Restaurant[] = [...portlandRestaurants, ...chicagoRestaurants]
