/**
 * The one place the app chooses its data source. To use Supabase later,
 * implement RestaurantRepository and construct it here; no UI code changes.
 */
import { getBrowserStore } from './keyValueStore'
import { createLocalRepository } from './localRepository'
import type { RestaurantRepository } from './repository'

export const repository: RestaurantRepository = createLocalRepository({ store: getBrowserStore() })

export { ATTRIBUTE_LABELS, ATTR_KEYS } from './attributes'
export { createLocalRepository } from './localRepository'
export type { LocalRepositoryOptions } from './localRepository'
export { createMemoryStore } from './keyValueStore'
export type { KeyValueStore } from './keyValueStore'
export type {
  NearbyOptions,
  NearbyResult,
  RestaurantQuery,
  RestaurantRepository,
  WaitProvider,
} from './repository'
export * from './types'
