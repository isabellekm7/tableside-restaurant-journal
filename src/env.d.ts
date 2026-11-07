/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Optional: without it the app uses the bundled sample data. */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase PUBLISHABLE key (sb_publishable_…). Never a secret / service-role key. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}
