import type { WaitEstimate, WaitLevel, WaitProfile } from '../../data/types'
import { windowContains } from '../time/hours'
import { localParts } from '../time/localTime'

/** FNV-1a: a tiny deterministic hash so "random" jitter is repeatable in tests and demos. */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function waitLevel(minutes: number): WaitLevel {
  if (minutes <= 10) return 'short'
  if (minutes <= 20) return 'moderate'
  return 'long'
}

const HALF_HOUR_MS = 30 * 60 * 1000

/**
 * SIMULATED wait: a baseline plus time-of-day peaks, nudged ±15% by a
 * deterministic jitter that changes every half hour. The prototype's real-source
 * seam is the WaitProvider interface in data/repository.ts; this function is
 * just the simulated provider's engine.
 */
export function estimateWait(profile: WaitProfile, timeZone: string, at: Date, seedKey: string): WaitEstimate {
  const local = localParts(at, timeZone)
  const extra = profile.peaks
    .filter((p) => windowContains(p, local))
    .reduce((sum, p) => sum + p.extraMinutes, 0)
  const bucket = Math.floor(at.getTime() / HALF_HOUR_MS)
  const jitter = ((hash(`${seedKey}:${bucket}`) % 31) - 15) / 100 // -0.15 … +0.15
  const raw = (profile.baseMinutes + extra) * (1 + jitter)
  const minutes = Math.max(0, Math.round(raw / 5) * 5)
  return { minutes, level: waitLevel(minutes), source: 'simulated', asOf: at.toISOString() }
}
