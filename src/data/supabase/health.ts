import type { SupabaseClient } from '@supabase/supabase-js'

export interface ConnectionCheck {
  ok: boolean
  restaurants: number | null
  cities: number | null
  /** Round-trip time for the check, in milliseconds. */
  ms: number
  error?: string
}

/**
 * Read-only connection check: counts rows with HEAD requests (no data is
 * downloaded, nothing is written, no account or session is created).
 */
export async function checkSupabaseConnection(client: SupabaseClient, clock: () => number = () => performance.now()): Promise<ConnectionCheck> {
  const started = clock()
  try {
    const [restaurants, cities] = await Promise.all([
      client.from('restaurants').select('id', { count: 'exact', head: true }).retry(false),
      client.from('cities').select('id', { count: 'exact', head: true }).retry(false),
    ])
    const ms = Math.round(clock() - started)
    const error = restaurants.error?.message ?? cities.error?.message
    if (error) return { ok: false, restaurants: null, cities: null, ms, error }
    return { ok: true, restaurants: restaurants.count, cities: cities.count, ms }
  } catch (error) {
    return { ok: false, restaurants: null, cities: null, ms: Math.round(clock() - started), error: error instanceof Error ? error.message : 'Network error' }
  }
}
