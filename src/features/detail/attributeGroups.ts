import type { AttrKey } from '../../data'

/** How the "what parents confirmed" list is grouped. Every attribute must appear exactly once (a test checks). */
export const ATTRIBUTE_GROUPS: ReadonlyArray<{ title: string; keys: readonly AttrKey[] }> = [
  { title: 'Seating and gear', keys: ['highChairs', 'boosterSeats', 'changingTable', 'strollerSpace', 'carrierRoom', 'nursingFriendly'] },
  { title: 'Food and timing', keys: ['foodSpeed', 'kidsMenu', 'customizableDishes', 'sippyCupFriendly', 'menuVariety'] },
  { title: 'Atmosphere', keys: ['noiseLevel', 'messTolerance', 'quietCorner', 'staffWelcome'] },
  { title: 'Outdoors and play', keys: ['activities', 'outdoorSpace', 'nearbyPark'] },
]
