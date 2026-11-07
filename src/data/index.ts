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
import { recordFallback } from './backendStatus'
import { getBrowserStore } from './keyValueStore'
import { createLocalRepository } from './localRepository'
import type { RestaurantRepository } from './repository'
import { createResilientRepository } from './resilientRepository'
import { readSupabaseConfig } from './supabase/config'
import { checkSupabaseConnection, type ConnectionCheck } from './supabase/health'
import { createSupabaseRepository } from './supabase/supabaseRepository'

const local = createLocalRepository({ store: getBrowserStore() })
const config = readSupabaseConfig(import.meta.env)
const client = config ? createClient(config.url, config.publishableKey) : null

export const dataSource: 'supabase' | 'local' = client ? 'supabase' : 'local'

export const repository: RestaurantRepository = client
  ? createResilientRepository({
      local,
      remote: createSupabaseRepository(client),
      onFallback: (operation, error) => {
        recordFallback(operation, error)
        console.warn(`[tableside] Supabase ${operation} failed; using this device’s data instead.`, error)
      },
    })
  : local

/** What /debug shows about the backend. `check` is null when Supabase isn't configured. */
export const backend: {
  source: 'supabase' | 'local'
  /** Host only: never the key. */
  host: string | null
  check: (() => Promise<ConnectionCheck>) | null
} = {
  source: dataSource,
  host: config ? new URL(config.url).host : null,
  check: client ? () => checkSupabaseConnection(client) : null,
}
export type { ConnectionCheck } from './supabase/health'
export { clearFallbackIncidents, getFallbackIncidents } from './backendStatus'
export type { FallbackIncident } from './backendStatus'

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
