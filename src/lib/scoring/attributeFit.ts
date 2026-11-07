import type { AttrKey, KidAttributes, KidAttributeValues } from '../../data/types'
import type { ScoringBand, ScoringConfig } from './config'

/** How well one reported attribute suits a band, with plain-language phrases for explanations. */
export interface AttributeFit {
  /** 0 (bad) to 1 (ideal). */
  fit: number
  /** Used in reasons, e.g. "4 high chairs". */
  positive: string
  /** Used in warnings, e.g. "no high chairs". */
  negative: string
}

type BooleanKey = { [K in AttrKey]: KidAttributeValues[K] extends boolean ? K : never }[AttrKey]

const BOOLEAN_PHRASES: Record<BooleanKey, { have: string; lack: string }> = {
  boosterSeats: { have: 'booster seats', lack: 'no booster seats' },
  changingTable: { have: 'a changing table', lack: 'no changing table' },
  strollerSpace: { have: 'room for strollers', lack: 'tight for strollers' },
  nursingFriendly: { have: 'nursing-friendly', lack: 'not set up for nursing' },
  carrierRoom: { have: 'room for a carrier at the table', lack: 'little room for a carrier' },
  quietCorner: { have: 'a quiet corner', lack: 'no quiet corner' },
  kidsMenu: { have: 'a kids’ menu', lack: 'no kids’ menu' },
  activities: { have: 'crayons or activities', lack: 'nothing to keep kids busy' },
  customizableDishes: { have: 'simple, customizable dishes', lack: 'few customizable dishes' },
  sippyCupFriendly: { have: 'sippy-cup friendly', lack: 'not sippy-cup friendly' },
  outdoorSpace: { have: 'outdoor seating', lack: 'no outdoor space' },
  nearbyPark: { have: 'a park nearby', lack: 'no park nearby' },
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Fit of one attribute for a band, or null when the restaurant hasn't reported
 * it (unknown is skipped by the scorer, never treated as "no").
 */
export function attributeFit(
  key: AttrKey,
  attrs: Partial<KidAttributes>,
  band: ScoringBand,
  config: ScoringConfig,
): AttributeFit | null {
  switch (key) {
    case 'highChairs': {
      const a = attrs.highChairs
      if (!a) return null
      const n = Math.max(0, Math.floor(a.value))
      const curve = config.highChairFit
      return {
        fit: curve[Math.min(n, curve.length - 1)] ?? 0,
        positive: plural(n, 'high chair'),
        negative: n === 0 ? 'no high chairs' : `only ${plural(n, 'high chair')}`,
      }
    }
    case 'foodSpeed': {
      const a = attrs.foodSpeed
      if (!a) return null
      return { fit: config.foodSpeedFit[a.value], positive: 'fast kitchen', negative: 'slow kitchen' }
    }
    case 'noiseLevel': {
      const a = attrs.noiseLevel
      if (!a) return null
      const positive = {
        quiet: 'quiet room',
        moderate: 'comfortable noise level',
        loud: 'lively room where kid noise blends in',
      }[a.value]
      const negative = {
        quiet: 'very quiet room, so kid noise carries',
        moderate: 'moderate noise',
        loud: 'loud room',
      }[a.value]
      return { fit: config.bands[band].noiseFit[a.value], positive, negative }
    }
    case 'messTolerance': {
      const a = attrs.messTolerance
      if (!a) return null
      return {
        fit: config.messToleranceFit[a.value],
        positive: 'relaxed about spills and mess',
        negative: 'not set up for spills and mess',
      }
    }
    case 'menuVariety': {
      const a = attrs.menuVariety
      if (!a) return null
      return {
        fit: config.menuVarietyFit[a.value],
        positive: a.value === 'wide' ? 'wide menu' : 'good menu variety',
        negative: 'limited menu',
      }
    }
    case 'staffWelcome': {
      const a = attrs.staffWelcome
      if (!a) return null
      return {
        fit: config.staffWelcomeFit[a.value],
        positive: 'warm staff',
        negative: 'staff may not feel welcoming to families',
      }
    }
    default: {
      const a = attrs[key]
      if (!a) return null
      const phrases = BOOLEAN_PHRASES[key]
      return { fit: a.value ? 1 : 0, positive: phrases.have, negative: phrases.lack }
    }
  }
}
