import type { AttrKey } from './types'

/**
 * Human-readable names for every kid-fit attribute (used by the detail page's
 * breakdown). Typed as a full Record so adding an attribute to the model
 * without naming it here is a compile error.
 */
export const ATTRIBUTE_LABELS: Record<AttrKey, string> = {
  highChairs: 'High chairs',
  boosterSeats: 'Booster seats',
  changingTable: 'Changing table',
  strollerSpace: 'Stroller space',
  nursingFriendly: 'Nursing-friendly',
  carrierRoom: 'Room for a carrier',
  quietCorner: 'Quiet corner',
  kidsMenu: 'Kids’ menu',
  activities: 'Crayons or activities',
  customizableDishes: 'Simple, customizable dishes',
  sippyCupFriendly: 'Sippy-cup friendly',
  outdoorSpace: 'Outdoor space',
  nearbyPark: 'Park nearby',
  foodSpeed: 'Food arrives',
  noiseLevel: 'Noise level',
  messTolerance: 'Mess tolerance',
  menuVariety: 'Menu variety',
  staffWelcome: 'Staff welcome',
}

export const ATTR_KEYS = Object.keys(ATTRIBUTE_LABELS) as AttrKey[]
