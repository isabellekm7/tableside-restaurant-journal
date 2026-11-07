import type { AgeBand, Child } from '../../data/types'
import { nextChildId } from '../../lib/profile/children'
import { MAX_CHILDREN, bandForAge } from '../../lib/scoring/ageBands'

/**
 * An in-progress child row in the form. `key` doubles as the final child id, so
 * editing keeps ids stable (and anything keyed by child id keeps working).
 */
export interface Draft {
  key: string
  band: AgeBand | null
  ageYears: number | null
}

const blank = (existingKeys: readonly string[]): Draft => ({ key: nextChildId(existingKeys), band: null, ageYears: null })

export function draftsFromChildren(children: readonly Child[]): Draft[] {
  if (children.length === 0) return [blank([])]
  return children.map((c) => ({ key: c.id, band: c.band, ageYears: c.ageYears ?? null }))
}

export function canAddDraft(drafts: readonly Draft[]): boolean {
  return drafts.length < MAX_CHILDREN
}

export function addDraft(drafts: readonly Draft[]): Draft[] {
  if (!canAddDraft(drafts)) return [...drafts]
  return [...drafts, blank(drafts.map((d) => d.key))]
}

export function removeDraft(drafts: readonly Draft[], key: string): Draft[] {
  // Always keep at least one row; clearing everyone is a separate, explicit action.
  return drafts.length <= 1 ? [...drafts] : drafts.filter((d) => d.key !== key)
}

/** Choosing a band keeps the exact age only if it still belongs to that band. */
export function setBand(drafts: readonly Draft[], key: string, band: AgeBand): Draft[] {
  return drafts.map((d) => {
    if (d.key !== key) return d
    const keepAge = d.ageYears !== null && bandForAge(d.ageYears) === band
    return { ...d, band, ageYears: keepAge ? d.ageYears : null }
  })
}

/** Choosing an exact age also sets the band it belongs to. */
export function setAge(drafts: readonly Draft[], key: string, ageYears: number | null): Draft[] {
  return drafts.map((d) => {
    if (d.key !== key) return d
    return ageYears === null ? { ...d, ageYears: null } : { ...d, ageYears, band: bandForAge(ageYears) }
  })
}

export function isComplete(drafts: readonly Draft[]): boolean {
  return drafts.length > 0 && drafts.every((d) => d.band !== null)
}

export function childrenFromDrafts(drafts: readonly Draft[]): Child[] {
  const children: Child[] = []
  for (const d of drafts) {
    if (d.band === null) continue
    children.push(d.ageYears === null ? { id: d.key, band: d.band } : { id: d.key, band: d.band, ageYears: d.ageYears })
  }
  return children
}
