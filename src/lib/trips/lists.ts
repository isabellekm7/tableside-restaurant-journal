import type { TripList } from '../../data/types'

/** The database allows up to 100 places per list; enforce it everywhere so saving never fails late. */
export const MAX_LIST_SIZE = 100
export const MAX_LIST_NAME = 60
export const DEFAULT_LIST_NAME = 'My trip'

/** Trim, collapse whitespace, cap length, and never return an empty name. */
export function sanitizeListName(name: string, fallback = DEFAULT_LIST_NAME): string {
  const cleaned = name.replace(/\s+/g, ' ').trim().slice(0, MAX_LIST_NAME).trim()
  return cleaned || fallback
}

/** "Weekend", "Weekend 2", "Weekend 3"… so two lists never share a name. */
export function uniqueListName(existing: readonly string[], wanted: string): string {
  const base = sanitizeListName(wanted)
  const taken = new Set(existing.map((n) => n.toLowerCase()))
  if (!taken.has(base.toLowerCase())) return base
  for (let n = 2; ; n++) {
    const candidate = `${base.slice(0, MAX_LIST_NAME - String(n).length - 1)} ${n}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
}

export type AddResult = { list: TripList; changed: boolean; full: boolean }

export function addToList(list: TripList, restaurantId: string): AddResult {
  if (list.restaurantIds.includes(restaurantId)) return { list, changed: false, full: false }
  if (list.restaurantIds.length >= MAX_LIST_SIZE) return { list, changed: false, full: true }
  return { list: { ...list, restaurantIds: [...list.restaurantIds, restaurantId] }, changed: true, full: false }
}

export function removeFromList(list: TripList, restaurantId: string): TripList {
  return list.restaurantIds.includes(restaurantId) ? { ...list, restaurantIds: list.restaurantIds.filter((id) => id !== restaurantId) } : list
}

export function isSaved(list: TripList | undefined, restaurantId: string): boolean {
  return list?.restaurantIds.includes(restaurantId) ?? false
}

export function newTripList(id: string, name: string, now: Date, restaurantIds: readonly string[] = []): TripList {
  const iso = now.toISOString()
  return { id, name: sanitizeListName(name), restaurantIds: restaurantIds.slice(0, MAX_LIST_SIZE), createdAt: iso, updatedAt: iso }
}
