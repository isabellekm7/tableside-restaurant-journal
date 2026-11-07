import type { WaitEstimate } from '../../data/types'
import type { RankedRestaurant } from '../discovery/rank'

/**
 * "Right now" mode: where can we sit down soon, nearby, with a good fit for the
 * kids? All the knobs live here so the product's opinion is easy to tune.
 */
export interface RightNowConfig {
  /** A place must stay open at least this long, or the meal gets cut short. */
  minMinutesOpen: number
  /** Longest wait we call "short". */
  maxWaitMinutes: number
  /** Longest trip (walk or ride) we call "close". */
  maxTravelMinutes: number
  /** In relaxed mode, still need this long before closing. */
  relaxedMinMinutesOpen: number
  /** Score = kid-fit score minus these penalties, so waiting and travelling cost points. */
  waitPenaltyPerMinute: number
  travelPenaltyPerMinute: number
  maxPicks: number
}

export const DEFAULT_RIGHT_NOW_CONFIG: RightNowConfig = {
  minMinutesOpen: 45,
  maxWaitMinutes: 15,
  maxTravelMinutes: 15,
  relaxedMinMinutesOpen: 20,
  waitPenaltyPerMinute: 1,
  travelPenaltyPerMinute: 0.5,
  maxPicks: 3,
}

export interface RightNowCandidate {
  item: RankedRestaurant
  /** Null when no wait estimate is available. */
  wait: WaitEstimate | null
}

/** Why a pick isn't ideal (only present in relaxed results). */
export type Shortfall = 'fit' | 'wait' | 'travel' | 'closingSoon'

export interface RightNowPick {
  candidate: RightNowCandidate
  /** Kid-fit score minus wait and travel penalties. Higher is better. */
  score: number
  shortfalls: Shortfall[]
}

export interface RightNowResult {
  picks: RightNowPick[]
  /** True when nothing met every criterion and these are the closest compromises. */
  relaxed: boolean
  /** How many places are open at all right now. */
  openCount: number
}

const UNKNOWN_WAIT_PENALTY_MINUTES = 15

function scoreOf(c: RightNowCandidate, config: RightNowConfig): number {
  const wait = c.wait?.minutes ?? UNKNOWN_WAIT_PENALTY_MINUTES
  const fit = c.item.fit.level === 'unknown' ? 0 : c.item.fit.score
  return fit - config.waitPenaltyPerMinute * wait - config.travelPenaltyPerMinute * c.item.travel.minutes
}

function shortfallsOf(c: RightNowCandidate, config: RightNowConfig): Shortfall[] {
  const out: Shortfall[] = []
  const { fit, travel, minutesUntilClose } = c.item
  if (fit.level !== 'great' && fit.level !== 'good') out.push('fit')
  if (c.wait === null || c.wait.minutes > config.maxWaitMinutes) out.push('wait')
  if (travel.minutes > config.maxTravelMinutes) out.push('travel')
  if (minutesUntilClose !== null && minutesUntilClose < config.minMinutesOpen) out.push('closingSoon')
  return out
}

/**
 * Pick the best places to eat soon. Strict first: open with time to eat, a short
 * wait, close by, and a great/good fit for every child. If nothing qualifies,
 * fall back to the best open places and say exactly where each falls short.
 */
export function recommendRightNow(
  candidates: readonly RightNowCandidate[],
  config: RightNowConfig = DEFAULT_RIGHT_NOW_CONFIG,
): RightNowResult {
  const open = candidates.filter((c) => c.item.open)
  const scored = (list: readonly RightNowCandidate[]): RightNowPick[] =>
    list
      .map((candidate) => ({ candidate, score: scoreOf(candidate, config), shortfalls: shortfallsOf(candidate, config) }))
      .sort((a, b) => b.score - a.score || a.candidate.item.distanceKm - b.candidate.item.distanceKm)

  const strict = scored(open).filter((p) => p.shortfalls.length === 0)
  if (strict.length > 0) return { picks: strict.slice(0, config.maxPicks), relaxed: false, openCount: open.length }

  const relaxedPool = open.filter(
    (c) => c.item.minutesUntilClose === null || c.item.minutesUntilClose >= config.relaxedMinMinutesOpen,
  )
  const picks = scored(relaxedPool).filter((p) => p.candidate.item.fit.level !== 'poor').slice(0, config.maxPicks)
  return { picks, relaxed: true, openCount: open.length }
}
