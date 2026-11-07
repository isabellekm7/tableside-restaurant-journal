/**
 * The kid-fit scale shared by scoring (Phase 2) and the UI.
 * Kept here, away from both, so lib/ never imports from components/.
 */
export const FIT_LEVELS = ['great', 'good', 'mixed', 'poor', 'unknown'] as const

export type FitLevel = (typeof FIT_LEVELS)[number]

/** Plain-language name for each level. Never rely on colour alone. */
export const FIT_LEVEL_LABEL: Record<FitLevel, string> = {
  great: 'Great fit',
  good: 'Good fit',
  mixed: 'Mixed fit',
  poor: 'Not a fit',
  unknown: 'Not enough info',
}
