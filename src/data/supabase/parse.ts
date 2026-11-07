import { ATTR_KEYS } from '../attributes'
import {
  AGE_BANDS,
  WEEKDAYS,
  type AgeBand,
  type Attribute,
  type AttrKey,
  type City,
  type CityId,
  type DietaryTag,
  type KidAttributes,
  type KidAttributeValues,
  type KidWindow,
  type NewFeedback,
  type OpeningPeriod,
  type ParentFeedback,
  type PriceLevel,
  type Restaurant,
  type TripList,
  type WaitProfile,
  type Weekday,
} from '../types'

/*
 * Rows coming back from the network are UNTRUSTED: a bad migration, a manual
 * edit in the dashboard, or an old app version could produce anything. Every
 * parser here takes `unknown`, validates, and returns null (or drops the bad
 * item) instead of throwing, so one malformed row can't blank the whole app.
 */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === 'string'
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean'
const stringArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isString) : [])
const CLOCK = /^([01]?\d|2[0-4]):[0-5]\d$/

function oneOf<T extends string>(options: readonly T[]) {
  return (v: unknown): v is T => options.some((o) => o === v)
}

const isWeekday = oneOf<Weekday>(WEEKDAYS)
const isCityId = oneOf<CityId>(['portland', 'chicago'])
const isBand = oneOf<AgeBand>(AGE_BANDS)

function days(v: unknown): Weekday[] | null {
  return Array.isArray(v) && v.every(isWeekday) ? v : null
}

// ───────────── Cities ─────────────

export function parseCity(row: unknown): City | null {
  if (!isRecord(row)) return null
  const { id, name, region, center_lat, center_lng, zoom, time_zone } = row
  if (!isCityId(id) || !isString(name) || !isString(region) || !isNumber(center_lat) || !isNumber(center_lng) || !isNumber(zoom) || !isString(time_zone)) {
    return null
  }
  return { id, name, region, center: { lat: center_lat, lng: center_lng }, zoom, timeZone: time_zone }
}

// ───────────── Restaurants ─────────────

function parseHours(v: unknown): OpeningPeriod[] {
  if (!Array.isArray(v)) return []
  return v.flatMap((item): OpeningPeriod[] => {
    if (!isRecord(item)) return []
    const d = days(item.days)
    return d && isString(item.open) && isString(item.close) && CLOCK.test(item.open) && CLOCK.test(item.close)
      ? [{ days: d, open: item.open, close: item.close }]
      : []
  })
}

function parseKidWindows(v: unknown): KidWindow[] {
  if (!Array.isArray(v)) return []
  return v.flatMap((item): KidWindow[] => {
    if (!isRecord(item)) return []
    const d = days(item.days)
    return d && isString(item.start) && isString(item.end) && isString(item.note) && CLOCK.test(item.start) && CLOCK.test(item.end)
      ? [{ days: d, start: item.start, end: item.end, note: item.note }]
      : []
  })
}

function parseWaitProfile(v: unknown): WaitProfile {
  const fallback: WaitProfile = { baseMinutes: 10, peaks: [] }
  if (!isRecord(v) || !isNumber(v.baseMinutes)) return fallback
  const peaks = Array.isArray(v.peaks)
    ? v.peaks.flatMap((p): WaitProfile['peaks'][number][] => {
        if (!isRecord(p)) return []
        const d = days(p.days)
        return d && isString(p.start) && isString(p.end) && isNumber(p.extraMinutes) && CLOCK.test(p.start) && CLOCK.test(p.end)
          ? [{ days: d, start: p.start, end: p.end, extraMinutes: p.extraMinutes }]
          : []
      })
    : []
  return { baseMinutes: v.baseMinutes, peaks }
}

/** Per-attribute value validators: a malformed value drops that one fact, not the restaurant. */
const VALUE_VALIDATORS: { [K in AttrKey]: (v: unknown) => v is KidAttributeValues[K] } = {
  highChairs: (v): v is number => isNumber(v) && v >= 0,
  boosterSeats: isBoolean,
  changingTable: isBoolean,
  strollerSpace: isBoolean,
  nursingFriendly: isBoolean,
  carrierRoom: isBoolean,
  quietCorner: isBoolean,
  kidsMenu: isBoolean,
  activities: isBoolean,
  customizableDishes: isBoolean,
  sippyCupFriendly: isBoolean,
  outdoorSpace: isBoolean,
  nearbyPark: isBoolean,
  foodSpeed: oneOf(['fast', 'moderate', 'slow'] as const),
  noiseLevel: oneOf(['quiet', 'moderate', 'loud'] as const),
  messTolerance: oneOf(['high', 'medium', 'low'] as const),
  menuVariety: oneOf(['limited', 'good', 'wide'] as const),
  staffWelcome: oneOf(['warm', 'neutral', 'cool'] as const),
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function provenance(row: Record<string, unknown>): { lastConfirmedAt: string; confirmationCount: number } | null {
  const { last_confirmed_at, confirmation_count } = row
  if (!isString(last_confirmed_at) || !ISO_DATE.test(last_confirmed_at.slice(0, 10)) || !isNumber(confirmation_count) || confirmation_count < 1) return null
  return { lastConfirmedAt: last_confirmed_at.slice(0, 10), confirmationCount: confirmation_count }
}

function putAttribute<K extends AttrKey>(out: Partial<KidAttributes>, key: K, value: unknown, meta: { lastConfirmedAt: string; confirmationCount: number }): void {
  if (!VALUE_VALIDATORS[key](value)) return
  out[key] = { value, ...meta } as KidAttributes[K]
}

function parseAttributes(rows: unknown): Partial<KidAttributes> {
  const out: Partial<KidAttributes> = {}
  if (!Array.isArray(rows)) return out
  for (const row of rows) {
    if (!isRecord(row)) continue
    const key = ATTR_KEYS.find((k) => k === row.key)
    const meta = provenance(row)
    if (key && meta) putAttribute(out, key, row.value, meta)
  }
  return out
}

const isDietaryTag = oneOf<DietaryTag>(['glutenFree', 'dairyFree', 'nutAllergyAware', 'vegetarian', 'vegan'])

function parseDietary(rows: unknown): Partial<Record<DietaryTag, Attribute<boolean>>> {
  const out: Partial<Record<DietaryTag, Attribute<boolean>>> = {}
  if (!Array.isArray(rows)) return out
  for (const row of rows) {
    if (!isRecord(row) || !isDietaryTag(row.tag) || !isBoolean(row.value)) continue
    const meta = provenance(row)
    if (meta) out[row.tag] = { value: row.value, ...meta }
  }
  return out
}

/** A `restaurants` row with embedded `restaurant_attributes` and `restaurant_dietary`. */
export function parseRestaurant(row: unknown): Restaurant | null {
  if (!isRecord(row)) return null
  const { id, city_id, name, cuisine, price_level, lat, lng, neighborhood, address_note, blurb } = row
  if (
    !isString(id) || !isCityId(city_id) || !isString(name) || !isString(cuisine) ||
    !isNumber(price_level) || ![1, 2, 3, 4].includes(price_level) ||
    !isNumber(lat) || !isNumber(lng) || !isString(neighborhood) || !isString(address_note) || !isString(blurb)
  ) {
    return null
  }
  const reportCount = isNumber(row.report_count) ? row.report_count : 0
  const listingKind = oneOf(['organic', 'sponsored', 'affiliate'] as const)(row.listing_kind) ? row.listing_kind : null

  return {
    id,
    name,
    cityId: city_id,
    cuisine,
    priceLevel: price_level as PriceLevel,
    location: { lat, lng },
    neighborhood,
    addressNote: address_note,
    blurb,
    attributes: parseAttributes(row.restaurant_attributes),
    dietary: parseDietary(row.restaurant_dietary),
    hours: parseHours(row.hours),
    kidWindows: parseKidWindows(row.kid_windows),
    waitProfile: parseWaitProfile(row.wait_profile),
    menuHighlights: stringArray(row.menu_highlights),
    watchOuts: stringArray(row.watch_outs),
    parentSignals: {
      reportCount,
      wouldReturnCount: isNumber(row.would_return_count) ? row.would_return_count : 0,
      notForUsCount: isNumber(row.not_for_us_count) ? row.not_for_us_count : 0,
    },
    ...(listingKind && { listing: { kind: listingKind, ...(isString(row.listing_partner) && { partner: row.listing_partner }) } }),
    isSample: true,
  }
}

// ───────────── Feedback ─────────────

/** The row sent to `feedback`. `user_id` and `created_at` are set by the database, never the client. */
export function feedbackToRow(id: string, feedback: NewFeedback) {
  return {
    id,
    restaurant_id: feedback.restaurantId,
    reporter_bands: [...feedback.reporterBands],
    had_high_chair: feedback.hadHighChair,
    staff_welcoming: feedback.staffWelcoming,
    wait_minutes: Math.round(feedback.waitMinutes),
    noise: feedback.noise,
    would_return: feedback.wouldReturn,
    not_for_us: feedback.notForUs,
  }
}

export function parseFeedback(row: unknown): ParentFeedback | null {
  if (!isRecord(row)) return null
  const { id, restaurant_id, created_at, reporter_bands, had_high_chair, staff_welcoming, wait_minutes, noise, would_return, not_for_us } = row
  if (
    !isString(id) || !isString(restaurant_id) || !isString(created_at) ||
    !Array.isArray(reporter_bands) || !reporter_bands.every(isBand) ||
    !oneOf(['yes', 'no', 'notNeeded'] as const)(had_high_chair) ||
    !oneOf(['yes', 'somewhat', 'no'] as const)(staff_welcoming) ||
    !isNumber(wait_minutes) || !oneOf(['quiet', 'moderate', 'loud'] as const)(noise) ||
    !isBoolean(would_return) || !isBoolean(not_for_us)
  ) {
    return null
  }
  return {
    id, restaurantId: restaurant_id, createdAt: created_at, reporterBands: reporter_bands,
    hadHighChair: had_high_chair, staffWelcoming: staff_welcoming, waitMinutes: wait_minutes,
    noise, wouldReturn: would_return, notForUs: not_for_us,
  }
}

// ───────────── Trip lists ─────────────

export function tripListToRow(userId: string, list: TripList) {
  return {
    user_id: userId,
    id: list.id,
    name: list.name,
    restaurant_ids: [...list.restaurantIds],
    created_at: list.createdAt,
    updated_at: list.updatedAt,
  }
}

export function parseTripList(row: unknown): TripList | null {
  if (!isRecord(row)) return null
  const { id, name, restaurant_ids, created_at, updated_at } = row
  if (!isString(id) || !isString(name) || !Array.isArray(restaurant_ids) || !isString(created_at) || !isString(updated_at)) return null
  return { id, name, restaurantIds: restaurant_ids.filter(isString), createdAt: created_at, updatedAt: updated_at }
}

/** Keep valid items only. */
export function parseAll<T>(rows: unknown, parse: (row: unknown) => T | null): T[] {
  return Array.isArray(rows) ? rows.flatMap((r) => parse(r) ?? []) : []
}
