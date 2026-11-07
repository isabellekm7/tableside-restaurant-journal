import { ATTR_KEYS } from '../attributes'
import { CITIES, SEED_RESTAURANTS } from '../seed'
import type { DietaryTag, Restaurant } from '../types'

/**
 * Test helpers: turn the bundled sample data into the rows Supabase would return
 * (snake_case columns, embedded child tables). Mirrors the schema in
 * supabase/migrations, so a mismatch between the two shows up as a failing test.
 */
export function cityRows() {
  return CITIES.map((c) => ({
    id: c.id, name: c.name, region: c.region, center_lat: c.center.lat, center_lng: c.center.lng, zoom: c.zoom, time_zone: c.timeZone,
  }))
}

export function restaurantRow(r: Restaurant) {
  return {
    id: r.id,
    city_id: r.cityId,
    name: r.name,
    cuisine: r.cuisine,
    price_level: r.priceLevel,
    lat: r.location.lat,
    lng: r.location.lng,
    neighborhood: r.neighborhood,
    address_note: r.addressNote,
    blurb: r.blurb,
    hours: r.hours,
    kid_windows: r.kidWindows,
    wait_profile: r.waitProfile,
    menu_highlights: r.menuHighlights,
    watch_outs: r.watchOuts,
    report_count: r.parentSignals.reportCount,
    would_return_count: r.parentSignals.wouldReturnCount,
    not_for_us_count: r.parentSignals.notForUsCount,
    listing_kind: r.listing?.kind ?? null,
    listing_partner: r.listing?.partner ?? null,
    is_sample: r.isSample,
    restaurant_attributes: ATTR_KEYS.flatMap((key) => {
      const a = r.attributes[key]
      return a ? [{ restaurant_id: r.id, key, value: a.value, last_confirmed_at: a.lastConfirmedAt, confirmation_count: a.confirmationCount }] : []
    }),
    restaurant_dietary: (Object.entries(r.dietary) as Array<[DietaryTag, { value: boolean; lastConfirmedAt: string; confirmationCount: number }]>).map(
      ([tag, a]) => ({ restaurant_id: r.id, tag, value: a.value, last_confirmed_at: a.lastConfirmedAt, confirmation_count: a.confirmationCount }),
    ),
  }
}

export const allRestaurantRows = () => SEED_RESTAURANTS.map(restaurantRow)
