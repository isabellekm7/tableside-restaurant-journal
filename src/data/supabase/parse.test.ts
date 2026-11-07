import { describe, expect, it } from 'vitest'
import { SEED_RESTAURANTS } from '../seed'
import type { NewFeedback } from '../types'
import { readSupabaseConfig } from './config'
import { allRestaurantRows, cityRows, restaurantRow } from './fixtures'
import { feedbackToRow, parseAll, parseCity, parseFeedback, parseRestaurant, parseTripList, tripListToRow } from './parse'

const fern = SEED_RESTAURANTS[0]
if (!fern) throw new Error('missing seed')

describe('parseRestaurant', () => {
  it('round-trips every sample restaurant exactly (the database shape matches the app model)', () => {
    for (const [i, row] of allRestaurantRows().entries()) {
      expect(parseRestaurant(row), SEED_RESTAURANTS[i]?.id).toEqual(SEED_RESTAURANTS[i])
    }
  })

  it('reads cities', () => {
    expect(parseAll(cityRows(), parseCity).map((c) => c.id)).toEqual(['portland', 'chicago'])
  })

  it('rejects rows missing required fields, or with impossible values', () => {
    const row = restaurantRow(fern)
    expect(parseRestaurant({ ...row, name: undefined })).toBeNull()
    expect(parseRestaurant({ ...row, price_level: 9 })).toBeNull()
    expect(parseRestaurant({ ...row, city_id: 'atlantis' })).toBeNull()
    expect(parseRestaurant({ ...row, lat: 'north' })).toBeNull()
    expect(parseRestaurant(null)).toBeNull()
    expect(parseRestaurant('nope')).toBeNull()
  })

  it('drops one bad fact without losing the restaurant', () => {
    const row = restaurantRow(fern)
    const damaged = {
      ...row,
      restaurant_attributes: [
        ...row.restaurant_attributes,
        { restaurant_id: fern.id, key: 'highChairs', value: 'lots', last_confirmed_at: '2026-10-11', confirmation_count: 3 }, // wrong type
        { restaurant_id: fern.id, key: 'madeUpThing', value: true, last_confirmed_at: '2026-10-11', confirmation_count: 3 }, // unknown key
        { restaurant_id: fern.id, key: 'noiseLevel', value: 'deafening', last_confirmed_at: '2026-10-11', confirmation_count: 3 }, // bad enum
        { restaurant_id: fern.id, key: 'kidsMenu', value: true, last_confirmed_at: 'yesterday', confirmation_count: 3 }, // bad date
      ],
    }
    const parsed = parseRestaurant(damaged)
    expect(parsed?.attributes.highChairs?.value).toBe(5) // later bad rows did not overwrite the good one
    expect(parsed?.attributes.noiseLevel?.value).toBe('loud')
    expect(Object.keys(parsed?.attributes ?? {})).not.toContain('madeUpThing')
  })

  it('survives malformed JSON columns by using safe defaults', () => {
    const parsed = parseRestaurant({
      ...restaurantRow(fern),
      hours: 'closed',
      kid_windows: [{ days: ['someday'], start: '8', end: '9', note: 'x' }, null],
      wait_profile: { nonsense: true },
      menu_highlights: [1, 'ok', null],
      watch_outs: 'none',
    })
    expect(parsed?.hours).toEqual([])
    expect(parsed?.kidWindows).toEqual([])
    expect(parsed?.waitProfile).toEqual({ baseMinutes: 10, peaks: [] })
    expect(parsed?.menuHighlights).toEqual(['ok'])
    expect(parsed?.watchOuts).toEqual([])
  })

  it('keeps commercial metadata separate and only when valid', () => {
    expect(parseRestaurant({ ...restaurantRow(fern), listing_kind: 'sponsored', listing_partner: 'Acme' })?.listing).toEqual({ kind: 'sponsored', partner: 'Acme' })
    expect(parseRestaurant({ ...restaurantRow(fern), listing_kind: 'pay-to-win' })?.listing).toBeUndefined()
  })

  it('parseAll skips invalid items instead of failing', () => {
    expect(parseAll([restaurantRow(fern), { junk: true }, null], parseRestaurant)).toHaveLength(1)
    expect(parseAll('not an array', parseRestaurant)).toEqual([])
  })
})

describe('feedback rows', () => {
  const input: NewFeedback = {
    restaurantId: 'pdx-little-fern-kitchen',
    reporterBands: ['toddler', 'preschool'],
    hadHighChair: 'yes',
    staffWelcoming: 'somewhat',
    waitMinutes: 12.4,
    noise: 'loud',
    wouldReturn: true,
    notForUs: false,
  }

  it('maps to snake_case and never sets user_id or created_at (the database does)', () => {
    const row = feedbackToRow('f-1', input)
    expect(row).toMatchObject({ id: 'f-1', restaurant_id: 'pdx-little-fern-kitchen', reporter_bands: ['toddler', 'preschool'], wait_minutes: 12, not_for_us: false })
    expect(Object.keys(row)).not.toContain('user_id')
    expect(Object.keys(row)).not.toContain('created_at')
  })

  it('parses rows back, rejecting bad ones', () => {
    const row = { ...feedbackToRow('f-1', input), created_at: '2026-11-07T10:00:00Z', user_id: 'u1' }
    expect(parseFeedback(row)).toMatchObject({ id: 'f-1', restaurantId: 'pdx-little-fern-kitchen', createdAt: '2026-11-07T10:00:00Z', waitMinutes: 12 })
    expect(parseFeedback({ ...row, reporter_bands: ['teenager'] })).toBeNull()
    expect(parseFeedback({ ...row, noise: 'screaming' })).toBeNull()
    expect(parseFeedback(undefined)).toBeNull()
  })
})

describe('trip list rows', () => {
  const list = { id: 'trip-1', name: 'Portland weekend', restaurantIds: ['a', 'b'], createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z' }

  it('round-trips', () => {
    const row = tripListToRow('user-1', list)
    expect(row.user_id).toBe('user-1')
    expect(parseTripList(row)).toEqual(list)
  })

  it('drops non-string restaurant ids and rejects broken rows', () => {
    expect(parseTripList({ ...tripListToRow('u', list), restaurant_ids: ['a', 5, null] })?.restaurantIds).toEqual(['a'])
    expect(parseTripList({ id: 'x' })).toBeNull()
  })
})

describe('readSupabaseConfig', () => {
  it('needs both values', () => {
    expect(readSupabaseConfig({})).toBeNull()
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull()
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' })).toBeNull()
  })

  it('accepts a valid pair and trims it', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: ' https://x.supabase.co/ ', VITE_SUPABASE_PUBLISHABLE_KEY: ' sb_publishable_abc ' })).toEqual({
      url: 'https://x.supabase.co',
      publishableKey: 'sb_publishable_abc',
    })
  })

  it('refuses insecure URLs, garbage, and above all secret keys in browser code', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'http://x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' })).toBeNull()
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'not a url', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' })).toBeNull()
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_oops' })).toBeNull()
  })

  it('allows plain http for a local Supabase', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' })?.url).toBe('http://localhost:54321')
  })
})
