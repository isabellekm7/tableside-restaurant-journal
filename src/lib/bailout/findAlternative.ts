import type { Restaurant, WaitEstimate } from '../../data/types'
import type { RankedRestaurant } from '../discovery/rank'

/**
 * The bail-out: "this isn't working, where's the nearest quick alternative?"
 *
 * Distances in the candidates must be measured FROM THE RESTAURANT THE FAMILY IS
 * AT (not from the city centre), because that's where they're standing.
 */
export interface BailOutConfig {
  /** A quick alternative has a wait no longer than this. */
  maxWaitMinutes: number
  /** And must stay open this long. */
  minMinutesOpen: number
  maxPicks: number
}

export const DEFAULT_BAIL_OUT_CONFIG: BailOutConfig = { maxWaitMinutes: 10, minMinutesOpen: 30, maxPicks: 3 }

export interface BailOutCandidate {
  item: RankedRestaurant
  wait: WaitEstimate | null
}

export type BailOutShortfall = 'notFast' | 'wait' | 'fit'

export interface BailOutPick {
  candidate: BailOutCandidate
  /** The kitchen is reported to be fast. */
  fastKitchen: boolean
  shortfalls: BailOutShortfall[]
}

export interface BailOutResult {
  picks: BailOutPick[]
  /** True when no place was both fast and well-suited; these are the nearest decent options. */
  relaxed: boolean
}

const isFast = (r: Restaurant): boolean => r.attributes.foodSpeed?.value === 'fast'

function describe(c: BailOutCandidate, config: BailOutConfig): BailOutPick {
  const { fit } = c.item
  const fastKitchen = isFast(c.item.restaurant)
  const shortfalls: BailOutShortfall[] = []
  if (!fastKitchen) shortfalls.push('notFast')
  if (c.wait === null || c.wait.minutes > config.maxWaitMinutes) shortfalls.push('wait')
  if (fit.level !== 'great' && fit.level !== 'good') shortfalls.push('fit')
  return { candidate: c, fastKitchen, shortfalls }
}

const nearestFirst = (a: BailOutPick, b: BailOutPick): number =>
  a.candidate.item.distanceKm - b.candidate.item.distanceKm || b.candidate.item.fit.score - a.candidate.item.fit.score

/**
 * Nearest first among places that are open, have a fast kitchen, a short wait, and a
 * good fit for the whole family. If none, the nearest open places that aren't a
 * poor fit, flagged with what falls short. The current restaurant is never offered.
 */
export function findBailOutOptions(input: {
  currentId: string
  candidates: readonly BailOutCandidate[]
  config?: BailOutConfig
}): BailOutResult {
  const config = input.config ?? DEFAULT_BAIL_OUT_CONFIG
  const open = input.candidates.filter(
    (c) =>
      c.item.restaurant.id !== input.currentId &&
      c.item.open &&
      (c.item.minutesUntilClose === null || c.item.minutesUntilClose >= config.minMinutesOpen),
  )
  const described = open.map((c) => describe(c, config))

  const strict = described.filter((p) => p.shortfalls.length === 0).sort(nearestFirst)
  if (strict.length > 0) return { picks: strict.slice(0, config.maxPicks), relaxed: false }

  const fallback = described
    .filter((p) => p.candidate.item.fit.level !== 'poor')
    // Fast kitchens and short waits matter most when things are going wrong.
    .sort((a, b) => a.shortfalls.length - b.shortfalls.length || nearestFirst(a, b))
  return { picks: fallback.slice(0, config.maxPicks), relaxed: true }
}
