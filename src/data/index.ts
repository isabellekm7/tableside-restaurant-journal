/**
 * The one place the app chooses its data source.
 *
 *   - With VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY set: Supabase, wrapped so the
 *     app keeps working offline or if the backend is unreachable (falls back to the device).
 *   - Without them: the bundled sample data and localStorage only.
 *
 * UI code never imports either implementation: it uses `repository` and the types.
 */
import { createClient } from '@supabase/supabase-js'
import { getBrowserStore } from './keyValueStore'
import { createLocalRepository } from './localRepository'
import type { RestaurantRepository } from './repository'
import { createResilientRepository } from './resilientRepository'
import { readSupabaseConfig } from './supabase/config'
import { createSupabaseRepository } from './supabase/supabaseRepository'

const local = createLocalRepository({ store: getBrowserStore() })
const config = readSupabaseConfig(import.meta.env)

export const dataSource: 'supabase' | 'local' = config ? 'supabase' : 'local'

export const repository: RestaurantRepository = config
  ? createResilientRepository({
      local,
      remote: createSupabaseRepository(createClient(config.url, config.publishableKey)),
      onFallback: (operation, error) => console.warn(`[tableside] Supabase ${operation} failed; using this device’s data instead.`, error),
    })
  : local

export { ATTRIBUTE_LABELS, ATTR_KEYS, DIETARY_DISCLAIMER, DIETARY_LABELS, DIETARY_TAGS } from './attributes'
export { createLocalRepository } from './localRepository'
export type { LocalRepository, LocalRepositoryOptions } from './localRepository'
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
