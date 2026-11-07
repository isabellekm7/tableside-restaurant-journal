import { ATTR_KEYS } from '../attributes'
import {
  WEEKDAYS,
  type Attribute,
  type AttrKey,
  type DietaryTag,
  type KidAttributes,
  type KidAttributeValues,
  type OpeningPeriod,
  type Restaurant,
  type Weekday,
} from '../types'

/** When and how strongly a group of facts was confirmed. */
export interface Confirmation {
  count: number
  /** ISO date. */
  date: string
}

export const ALL_DAYS: readonly Weekday[] = WEEKDAYS
export const MON_FRI: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri']
export const WEEKEND: readonly Weekday[] = ['sat', 'sun']
export const TUE_SUN: readonly Weekday[] = ['tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const daily = (open: string, close: string): OpeningPeriod[] => [{ days: ALL_DAYS, open, close }]

function put<K extends AttrKey>(
  out: Partial<KidAttributes>,
  key: K,
  spec: Partial<KidAttributeValues>,
  confirmation: Confirmation,
): void {
  const value = spec[key]
  if (value === undefined) return
  out[key] = {
    value,
    lastConfirmedAt: confirmation.date,
    confirmationCount: confirmation.count,
  } as KidAttributes[K]
}

/**
 * Build the attributes map from plain values. Anything left out stays unknown.
 * `overrides` lets individual facts carry their own confirmation date/count,
 * so "last confirmed" varies realistically.
 */
export function attrs(
  spec: Partial<KidAttributeValues>,
  base: Confirmation,
  overrides: Partial<Record<AttrKey, Confirmation>> = {},
): Partial<KidAttributes> {
  const out: Partial<KidAttributes> = {}
  for (const key of ATTR_KEYS) put(out, key, spec, overrides[key] ?? base)
  return out
}

export function diet(
  spec: Partial<Record<DietaryTag, boolean>>,
  confirmation: Confirmation,
): Partial<Record<DietaryTag, Attribute<boolean>>> {
  const out: Partial<Record<DietaryTag, Attribute<boolean>>> = {}
  for (const [tag, value] of Object.entries(spec) as Array<[DietaryTag, boolean]>) {
    out[tag] = { value, lastConfirmedAt: confirmation.date, confirmationCount: confirmation.count }
  }
  return out
}

/** Marks a record as fictional sample data. */
export function sample(restaurant: Omit<Restaurant, 'isSample'>): Restaurant {
  return { ...restaurant, isSample: true }
}
