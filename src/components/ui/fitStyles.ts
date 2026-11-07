import type { FitLevel } from '../../lib/fit'

/*
 * Class strings are written out in full (not built from the level name) so
 * Tailwind can see them. Colours come from the --color-fit-* tokens.
 */

/** Tinted background + dark text: badges, chips. */
export const fitBadgeClass: Record<FitLevel, string> = {
  great: 'bg-fit-great-bg text-fit-great-fg',
  good: 'bg-fit-good-bg text-fit-good-fg',
  mixed: 'bg-fit-mixed-bg text-fit-mixed-fg',
  poor: 'bg-fit-poor-bg text-fit-poor-fg',
  unknown: 'bg-fit-unknown-bg text-fit-unknown-fg',
}

/** Solid background + white text: map pins, meters. */
export const fitSolidClass: Record<FitLevel, string> = {
  great: 'bg-fit-great-solid text-on-solid',
  good: 'bg-fit-good-solid text-on-solid',
  mixed: 'bg-fit-mixed-solid text-on-solid',
  poor: 'bg-fit-poor-solid text-on-solid',
  unknown: 'bg-fit-unknown-solid text-on-solid',
}
