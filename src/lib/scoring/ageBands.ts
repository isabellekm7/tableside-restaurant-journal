import type { AgeBand, Child } from '../../data/types'

export const MIN_AGE = 0
export const MAX_AGE = 12
export const MAX_CHILDREN = 4

/**
 * Bands are by COMPLETED YEARS, matching how parents say ages ("my 2-year-old"):
 *   infant 0 · toddler 1-2 · preschool 3-5 · school-age 6-12
 * (The brief's ranges overlap at 1 and 3; this resolves it deterministically.)
 */
export function bandForAge(ageYears: number): AgeBand {
  if (!Number.isInteger(ageYears) || ageYears < MIN_AGE || ageYears > MAX_AGE) {
    throw new RangeError(`Age must be a whole number from ${MIN_AGE} to ${MAX_AGE}, got ${ageYears}`)
  }
  if (ageYears < 1) return 'infant'
  if (ageYears < 3) return 'toddler'
  if (ageYears < 6) return 'preschool'
  return 'schoolAge'
}

/** Whole-year ages that belong to a band, e.g. toddler → [1, 2]. */
export function agesForBand(band: AgeBand): number[] {
  const ages: number[] = []
  for (let age = MIN_AGE; age <= MAX_AGE; age++) if (bandForAge(age) === band) ages.push(age)
  return ages
}

export const BAND_LABEL: Record<AgeBand, string> = {
  infant: 'Infant',
  toddler: 'Toddler',
  preschool: 'Preschool',
  schoolAge: 'School-age',
}

/** Shown in onboarding next to each band. */
export const BAND_AGE_RANGE: Record<AgeBand, string> = {
  infant: 'Under 1',
  toddler: '1 to 2',
  preschool: '3 to 5',
  schoolAge: '6 to 12',
}

/** The band's representative everyday word, for sentences like "your toddler". */
const BAND_NOUN: Record<AgeBand, string> = {
  infant: 'baby',
  toddler: 'toddler',
  preschool: 'preschooler',
  schoolAge: 'school-age child',
}

export function childFromAge(id: string, ageYears: number): Child {
  return { id, band: bandForAge(ageYears), ageYears }
}

export function childFromBand(id: string, band: AgeBand): Child {
  return { id, band }
}

/** "2-year-old" when the exact age is known, otherwise the band noun ("toddler"). */
export function describeChild(child: Child): string {
  if (child.ageYears !== undefined && child.ageYears >= 1) return `${child.ageYears}-year-old`
  return BAND_NOUN[child.band]
}
