/**
 * Domain model for Tableside.
 *
 * These types are the contract between the UI and any data source. The local
 * seed implementation and a future Supabase implementation both satisfy them.
 * All sample restaurants are fictional.
 */

// ───────────── Children and age bands ─────────────

export const AGE_BANDS = ['infant', 'toddler', 'preschool', 'schoolAge'] as const
export type AgeBand = (typeof AGE_BANDS)[number]

/** One child in the family profile. Age bands are by completed years: see lib/scoring/ageBands. */
export interface Child {
  id: string
  band: AgeBand
  /** Present when the parent entered an exact age rather than just a band. */
  ageYears?: number
}

// ───────────── Places and time ─────────────

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export type Weekday = (typeof WEEKDAYS)[number]

export type CityId = 'portland' | 'chicago'

export interface LatLng {
  lat: number
  lng: number
}

export interface City {
  id: CityId
  name: string
  region: string
  center: LatLng
  zoom: number
  /** IANA time zone; hours and waits are interpreted in the restaurant's local time. */
  timeZone: string
}

/** "HH:MM", 24-hour, local to the restaurant. */
export type ClockTime = string

export interface OpeningPeriod {
  days: readonly Weekday[]
  open: ClockTime
  /** If earlier than or equal to `open`, the period runs past midnight. */
  close: ClockTime
}

export interface KidWindow {
  days: readonly Weekday[]
  start: ClockTime
  end: ClockTime
  /** e.g. "Quietest time of day" */
  note: string
}

// ───────────── Kid-fit attributes ─────────────

/** A parent-reported fact with provenance. */
export interface Attribute<T> {
  value: T
  /** ISO date (YYYY-MM-DD) a parent last confirmed this. */
  lastConfirmedAt: string
  /** How many parent reports back this up. */
  confirmationCount: number
}

export type NoiseLevel = 'quiet' | 'moderate' | 'loud'
export type FoodSpeed = 'fast' | 'moderate' | 'slow'
export type MessTolerance = 'high' | 'medium' | 'low'
export type MenuVariety = 'limited' | 'good' | 'wide'
export type StaffWelcome = 'warm' | 'neutral' | 'cool'

/** The value type of every kid-fit attribute. Add an attribute here, then in attributes.ts and scoring config. */
export interface KidAttributeValues {
  highChairs: number
  boosterSeats: boolean
  changingTable: boolean
  strollerSpace: boolean
  nursingFriendly: boolean
  carrierRoom: boolean
  quietCorner: boolean
  kidsMenu: boolean
  activities: boolean
  customizableDishes: boolean
  sippyCupFriendly: boolean
  outdoorSpace: boolean
  nearbyPark: boolean
  foodSpeed: FoodSpeed
  noiseLevel: NoiseLevel
  messTolerance: MessTolerance
  menuVariety: MenuVariety
  staffWelcome: StaffWelcome
}

export type AttrKey = keyof KidAttributeValues

export type KidAttributes = { [K in AttrKey]: Attribute<KidAttributeValues[K]> }

// ───────────── Restaurant ─────────────

export type PriceLevel = 1 | 2 | 3 | 4

/** What parents report about dietary options. Never presented as a safety guarantee. */
export type DietaryTag = 'glutenFree' | 'dairyFree' | 'nutAllergyAware' | 'vegetarian' | 'vegan'

/** Aggregated "would you return with kids" and "Not for us" reports. */
export interface ParentSignals {
  reportCount: number
  wouldReturnCount: number
  /** Parents who felt unwelcome. */
  notForUsCount: number
}

/** Simulated wait model: a baseline plus time-of-day peaks. */
export interface WaitProfile {
  baseMinutes: number
  peaks: ReadonlyArray<{
    days: readonly Weekday[]
    start: ClockTime
    end: ClockTime
    extraMinutes: number
  }>
}

/**
 * Commercial metadata, kept OUT of scoring on purpose. Nothing under
 * lib/scoring reads this field, and a test proves a sponsored listing scores
 * exactly like an organic one. Present only so B2B/affiliate ideas can be added
 * later without reshaping the model.
 */
export interface ListingMeta {
  kind: 'organic' | 'sponsored' | 'affiliate'
  partner?: string
}

export interface Restaurant {
  id: string
  name: string
  cityId: CityId
  cuisine: string
  priceLevel: PriceLevel
  location: LatLng
  neighborhood: string
  /** Deliberately vague (no street number) because venues are fictional. */
  addressNote: string
  blurb: string
  /** Attributes parents haven't reported are simply absent (unknown, not "no"). */
  attributes: Partial<KidAttributes>
  dietary: Partial<Record<DietaryTag, Attribute<boolean>>>
  hours: readonly OpeningPeriod[]
  kidWindows: readonly KidWindow[]
  waitProfile: WaitProfile
  menuHighlights: readonly string[]
  /** Honest downsides, shown on the detail page. */
  watchOuts: readonly string[]
  parentSignals: ParentSignals
  listing?: ListingMeta
  /** Every seeded restaurant is fictional; the UI shows a "Sample data" label. */
  isSample: true
}

// ───────────── Wait estimates ─────────────

export type WaitLevel = 'short' | 'moderate' | 'long'

export interface WaitEstimate {
  minutes: number
  level: WaitLevel
  /** "simulated" in the prototype; a real provider would return "live". */
  source: 'simulated' | 'live'
  /** ISO timestamp the estimate is for. */
  asOf: string
}

// ───────────── Feedback and saved lists ─────────────

export type HighChairAnswer = 'yes' | 'no' | 'notNeeded'
export type WelcomeAnswer = 'yes' | 'somewhat' | 'no'

export interface ParentFeedback {
  id: string
  restaurantId: string
  /** ISO timestamp. */
  createdAt: string
  /** Age bands of the reporter's children at the visit, so scores can be age-specific. */
  reporterBands: readonly AgeBand[]
  hadHighChair: HighChairAnswer
  staffWelcoming: WelcomeAnswer
  /** Actual wait before being seated or served, in minutes. */
  waitMinutes: number
  noise: NoiseLevel
  wouldReturn: boolean
  /** The "Not for us" signal: the family felt unwelcome. */
  notForUs: boolean
}

export type NewFeedback = Omit<ParentFeedback, 'id' | 'createdAt'>

export interface TripList {
  id: string
  name: string
  restaurantIds: readonly string[]
  createdAt: string
  updatedAt: string
}
