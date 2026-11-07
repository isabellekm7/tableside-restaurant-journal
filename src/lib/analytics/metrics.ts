import type { StoredEvent } from './events'

export const DECISION_GOAL_MS = 60_000

export interface SessionSummary {
  sessionId: string
  /** Epoch ms of the app_open event (or the first event if it's missing). */
  openedAt: number
  /**
   * THE 60-SECOND METRIC: ms from app open to the first restaurant_selected, or
   * null if the parent never selected a restaurant in this session.
   */
  msToDecision: number | null
  /** Milliseconds spent in onboarding (open → completed/skipped), so you can subtract it. */
  onboardingMs: number | null
  msToDecisionExcludingOnboarding: number | null
  metGoal: boolean | null
  bailOuts: number
  rightNowUsed: boolean
  filtersUsed: number
  restaurantsViewed: number
}

/** Group events by page-load session and compute the headline numbers for each. */
export function summarizeSessions(events: readonly StoredEvent[]): SessionSummary[] {
  const bySession = new Map<string, StoredEvent[]>()
  for (const e of events) bySession.set(e.sessionId, [...(bySession.get(e.sessionId) ?? []), e])

  const summaries: SessionSummary[] = []
  for (const [sessionId, list] of bySession) {
    const sorted = [...list].sort((a, b) => a.ts - b.ts || a.id - b.id)
    const open = sorted.find((e) => e.type === 'app_open') ?? sorted[0]
    if (!open) continue
    const selected = sorted.find((e) => e.type === 'restaurant_selected')
    const onboardingEnd = sorted.find((e) => e.type === 'onboarding_completed' || e.type === 'onboarding_skipped')

    const msToDecision = selected ? selected.ts - open.ts : null
    const onboardingMs = onboardingEnd ? onboardingEnd.ts - open.ts : null
    summaries.push({
      sessionId,
      openedAt: open.ts,
      msToDecision,
      onboardingMs,
      msToDecisionExcludingOnboarding:
        msToDecision === null ? null : Math.max(0, msToDecision - (onboardingMs ?? 0)),
      metGoal: msToDecision === null ? null : msToDecision <= DECISION_GOAL_MS,
      bailOuts: sorted.filter((e) => e.type === 'bail_out_used').length,
      rightNowUsed: sorted.some((e) => e.type === 'right_now_used'),
      filtersUsed: sorted.filter((e) => e.type === 'filter_used').length,
      restaurantsViewed: sorted.filter((e) => e.type === 'restaurant_viewed').length,
    })
  }
  return summaries.sort((a, b) => b.openedAt - a.openedAt)
}

/** Share of sessions with a decision that came within the 60-second goal; null when there are none. */
export function goalRate(summaries: readonly SessionSummary[]): number | null {
  const decided = summaries.filter((s) => s.metGoal !== null)
  if (decided.length === 0) return null
  return decided.filter((s) => s.metGoal).length / decided.length
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return '–'
  const seconds = Math.round(ms / 1000)
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
}
