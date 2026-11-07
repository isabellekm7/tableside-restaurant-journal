import { AGE_BANDS, type AgeBand, type Child } from '../../data/types'
import { MAX_AGE, MAX_CHILDREN, MIN_AGE, bandForAge } from '../scoring/ageBands'

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/**
 * Turn untrusted data (localStorage, which users and old app versions can edit)
 * into a valid child list. Bad entries are dropped; an exact age that disagrees
 * with the stored band is discarded rather than trusted.
 */
export function sanitizeChildren(value: unknown): Child[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const children: Child[] = []
  for (const item of value) {
    if (children.length >= MAX_CHILDREN) break
    if (!isRecord(item)) continue
    const { id, band, ageYears } = item
    if (typeof id !== 'string' || id === '' || seen.has(id)) continue
    const validBand = AGE_BANDS.find((b): b is AgeBand => b === band)
    if (!validBand) continue
    seen.add(id)
    const exact =
      typeof ageYears === 'number' &&
      Number.isInteger(ageYears) &&
      ageYears >= MIN_AGE &&
      ageYears <= MAX_AGE &&
      bandForAge(ageYears) === validBand
    children.push(exact ? { id, band: validBand, ageYears } : { id, band: validBand })
  }
  return children
}

/** The lowest "child-N" id not already used. */
export function nextChildId(existing: readonly string[]): string {
  let n = 1
  while (existing.includes(`child-${n}`)) n++
  return `child-${n}`
}
