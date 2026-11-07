/**
 * Supabase connection settings, read from Vite env vars (see .env.example).
 *
 * Only the URL and the PUBLISHABLE key belong here: that key is designed to ship
 * in browser code and is safe because row-level security guards every table.
 * Never put a service-role / secret key in a VITE_ variable: it would be bundled
 * into the app for everyone to read.
 */
export interface SupabaseConfig {
  url: string
  publishableKey: string
}

interface EnvLike {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

export function readSupabaseConfig(env: EnvLike): SupabaseConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim()
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !publishableKey) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') return null
  } catch {
    return null
  }
  // A secret key in browser code would be a serious leak: refuse it outright.
  if (publishableKey.startsWith('sb_secret_')) return null
  return { url: url.replace(/\/+$/, ''), publishableKey }
}
