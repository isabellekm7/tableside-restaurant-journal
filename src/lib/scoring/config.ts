import type {
  AgeBand,
  AttrKey,
  FoodSpeed,
  MenuVariety,
  MessTolerance,
  NoiseLevel,
  StaffWelcome,
} from '../../data/types'

/**
 * ALL kid-fit tuning lives in this file. Nothing about weights, thresholds or
 * caps is hardcoded in score.ts, so you can change the product's opinion here
 * and re-run the tests.
 *
 * How a child's score works:
 *   1. Each attribute the restaurant reports gets a "fit" from 0 (bad) to 1 (ideal).
 *   2. Fits are averaged using the child's band weights (0-10, below).
 *      Attributes parents haven't reported are skipped, not counted as "no".
 *   3. Hard requirements can cap the score (e.g. no high chairs for a toddler).
 *   4. The family score is the LOWEST child score: the strictest need wins.
 */

/** A band, or "generic" when no children have been added yet. */
export type ScoringBand = AgeBand | 'generic'

export interface BandConfig {
  /** How much each attribute matters for this band, 0 to 10. Omitted = ignored. */
  weights: Partial<Record<AttrKey, number>>
  /** How well each noise level suits this band, 0 to 1. */
  noiseFit: Record<NoiseLevel, number>
  /**
   * Hard requirements. If the attribute's fit is at or below `atMost`, the score
   * can't exceed `cap`, and `warning` explains why.
   */
  caps: ReadonlyArray<{ attr: AttrKey; atMost: number; cap: number; warning: string }>
}

export interface ScoringConfig {
  /** Minimum score for each level. Below `mixed` is "poor". */
  levels: { great: number; good: number; mixed: number }
  /** Share of a band's total weight that must be reported, else the level is "unknown". */
  minCoverage: number
  /** Coverage at or above this reads as "high confidence". */
  confidenceHigh: number
  /** Fit by number of high chairs: index 0 = none … last index = that many or more. */
  highChairFit: readonly number[]
  foodSpeedFit: Record<FoodSpeed, number>
  messToleranceFit: Record<MessTolerance, number>
  menuVarietyFit: Record<MenuVariety, number>
  staffWelcomeFit: Record<StaffWelcome, number>
  /** "Not for us" reports: if enough parents say they felt unwelcome, cap everyone's score. */
  notForUs: { minReports: number; minShare: number; cap: number; warning: string }
  /** Fits at or above `strong` become reasons; at or below `weak` become warnings. */
  explain: { strong: number; weak: number; maxReasons: number; maxWarnings: number }
  bands: Record<ScoringBand, BandConfig>
}

const welcomeCap = {
  attr: 'staffWelcome',
  atMost: 0,
  cap: 40,
  warning: 'staff may not feel welcoming to families',
} as const

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  levels: { great: 80, good: 65, mixed: 45 },
  minCoverage: 0.5,
  confidenceHigh: 0.8,

  highChairFit: [0, 0.4, 0.75, 0.75, 1],
  foodSpeedFit: { fast: 1, moderate: 0.6, slow: 0.1 },
  messToleranceFit: { high: 1, medium: 0.6, low: 0.2 },
  menuVarietyFit: { wide: 1, good: 0.75, limited: 0.3 },
  staffWelcomeFit: { warm: 1, neutral: 0.55, cool: 0 },

  notForUs: {
    minReports: 5,
    minShare: 0.25,
    cap: 50,
    warning: 'some parents said they felt unwelcome here',
  },

  explain: { strong: 0.75, weak: 0.4, maxReasons: 3, maxWarnings: 3 },

  bands: {
    infant: {
      weights: {
        changingTable: 9,
        strollerSpace: 8,
        nursingFriendly: 8,
        staffWelcome: 8,
        quietCorner: 7,
        carrierRoom: 6,
        noiseLevel: 6,
        highChairs: 3,
        foodSpeed: 3,
        messTolerance: 2,
      },
      noiseFit: { quiet: 1, moderate: 0.6, loud: 0.2 },
      caps: [
        welcomeCap,
        { attr: 'changingTable', atMost: 0, cap: 64, warning: 'no changing table' },
        { attr: 'strollerSpace', atMost: 0, cap: 69, warning: 'tight for strollers' },
      ],
    },
    toddler: {
      weights: {
        highChairs: 10,
        foodSpeed: 9,
        staffWelcome: 8,
        noiseLevel: 7,
        messTolerance: 7,
        sippyCupFriendly: 5,
        changingTable: 4,
        kidsMenu: 3,
        strollerSpace: 3,
        customizableDishes: 2,
        outdoorSpace: 2,
      },
      // A lively room is a plus for a toddler: nobody notices the noise.
      noiseFit: { quiet: 0.45, moderate: 0.85, loud: 1 },
      caps: [
        welcomeCap,
        { attr: 'highChairs', atMost: 0, cap: 40, warning: 'no high chairs' },
        { attr: 'foodSpeed', atMost: 0.1, cap: 60, warning: 'slow kitchen means a long wait with a hungry toddler' },
      ],
    },
    preschool: {
      weights: {
        kidsMenu: 8,
        staffWelcome: 8,
        activities: 7,
        boosterSeats: 7,
        customizableDishes: 7,
        noiseLevel: 5,
        foodSpeed: 5,
        messTolerance: 4,
        outdoorSpace: 3,
      },
      noiseFit: { quiet: 0.6, moderate: 1, loud: 0.7 },
      caps: [welcomeCap, { attr: 'boosterSeats', atMost: 0, cap: 69, warning: 'no booster seats' }],
    },
    schoolAge: {
      weights: {
        menuVariety: 8,
        staffWelcome: 7,
        outdoorSpace: 6,
        nearbyPark: 6,
        noiseLevel: 6,
        activities: 5,
        foodSpeed: 3,
        kidsMenu: 3,
        customizableDishes: 2,
      },
      // Not too loud, but not library-silent either.
      noiseFit: { quiet: 0.6, moderate: 1, loud: 0.4 },
      caps: [welcomeCap, { attr: 'menuVariety', atMost: 0.3, cap: 69, warning: 'limited menu' }],
    },
    // Used before any child is added: a neutral "welcomes families" read.
    generic: {
      weights: {
        staffWelcome: 9,
        kidsMenu: 5,
        menuVariety: 5,
        noiseLevel: 4,
        highChairs: 4,
        foodSpeed: 4,
        boosterSeats: 3,
        changingTable: 3,
        outdoorSpace: 2,
      },
      noiseFit: { quiet: 0.7, moderate: 1, loud: 0.6 },
      caps: [welcomeCap],
    },
  },
}
