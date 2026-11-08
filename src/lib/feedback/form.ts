import { AGE_BANDS, type AgeBand, type HighChairAnswer, type NewFeedback, type NoiseLevel, type WelcomeAnswer } from '../../data/types'

/**
 * The quick-tap "how did it go?" form: structured answers only, no free text, so it
 * takes seconds and can't be used to post abuse or personal details.
 */
export interface FeedbackDraft {
  /** The age bands of the children who were there. Pre-filled from the family profile. */
  bands: AgeBand[]
  hadHighChair: HighChairAnswer | null
  staffWelcoming: WelcomeAnswer | null
  waitMinutes: number | null
  noise: NoiseLevel | null
  wouldReturn: boolean | null
  /** "Not for us": the family felt unwelcome. */
  notForUs: boolean
}

export const WAIT_CHOICES = [
  { value: 0, label: 'No wait' },
  { value: 5, label: 'About 5 min' },
  { value: 10, label: 'About 10 min' },
  { value: 20, label: 'About 20 min' },
  { value: 35, label: '30 min or more' },
] as const

/** Bands in a stable order, without duplicates, from a family profile. */
export function bandsFromChildren(children: ReadonlyArray<{ band: AgeBand }>): AgeBand[] {
  const present = new Set(children.map((c) => c.band))
  return AGE_BANDS.filter((b) => present.has(b))
}

export function emptyDraft(bands: AgeBand[] = []): FeedbackDraft {
  return { bands, hadHighChair: null, staffWelcoming: null, waitMinutes: null, noise: null, wouldReturn: null, notForUs: false }
}

/** Questions that need an answer (age group + five quick taps). "Not for us" is optional. */
export const REQUIRED_QUESTIONS = 6

export function answeredCount(d: FeedbackDraft): number {
  return [d.bands.length > 0, d.hadHighChair !== null, d.staffWelcoming !== null, d.waitMinutes !== null, d.noise !== null, d.wouldReturn !== null].filter(Boolean).length
}

export const isComplete = (d: FeedbackDraft): boolean => answeredCount(d) === REQUIRED_QUESTIONS

/** The record to send, or null while any required answer is missing. */
export function toNewFeedback(restaurantId: string, d: FeedbackDraft): NewFeedback | null {
  if (!isComplete(d) || d.hadHighChair === null || d.staffWelcoming === null || d.waitMinutes === null || d.noise === null || d.wouldReturn === null) return null
  return {
    restaurantId,
    reporterBands: AGE_BANDS.filter((b) => d.bands.includes(b)),
    hadHighChair: d.hadHighChair,
    staffWelcoming: d.staffWelcoming,
    waitMinutes: d.waitMinutes,
    noise: d.noise,
    wouldReturn: d.wouldReturn,
    notForUs: d.notForUs,
  }
}

export function toggleBand(bands: readonly AgeBand[], band: AgeBand): AgeBand[] {
  return bands.includes(band) ? bands.filter((b) => b !== band) : AGE_BANDS.filter((b) => b === band || bands.includes(b))
}
