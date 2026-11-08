import type { ParentFeedback, ParentSignals } from '../../data/types'

/**
 * What the author sees: the catalog's parent signals PLUS their own reports, labelled
 * "includes your report" in the UI. Everyone else's view is unchanged: a single
 * anonymous report must never move another parent's numbers (no accounts, no moderation).
 */
export function blendSignals(signals: ParentSignals, own: readonly ParentFeedback[]): { signals: ParentSignals; includesYours: boolean } {
  if (own.length === 0) return { signals, includesYours: false }
  return {
    includesYours: true,
    signals: {
      reportCount: signals.reportCount + own.length,
      wouldReturnCount: signals.wouldReturnCount + own.filter((f) => f.wouldReturn).length,
      notForUsCount: signals.notForUsCount + own.filter((f) => f.notForUs).length,
    },
  }
}
