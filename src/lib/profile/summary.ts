import type { Child } from '../../data/types'
import { BAND_LABEL } from '../scoring/ageBands'

/** Short label for one child: "2y", "<1y", or the band name when no exact age was given. */
export function childShortLabel(child: Child): string {
  if (child.ageYears === undefined) return BAND_LABEL[child.band].toLowerCase()
  return child.ageYears === 0 ? '<1y' : `${child.ageYears}y`
}

/** Text for the persistent header chip, e.g. "2 kids: 2y, 5y". */
export function chipLabel(children: readonly Child[]): string {
  if (children.length === 0) return 'Add your kids'
  const noun = children.length === 1 ? 'kid' : 'kids'
  return `${children.length} ${noun}: ${children.map(childShortLabel).join(', ')}`
}
