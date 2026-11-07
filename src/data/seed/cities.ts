import type { City } from '../types'

export const CITIES: readonly City[] = [
  {
    id: 'portland',
    name: 'Portland',
    region: 'OR',
    center: { lat: 45.5231, lng: -122.6765 },
    zoom: 12,
    timeZone: 'America/Los_Angeles',
  },
  {
    id: 'chicago',
    name: 'Chicago',
    region: 'IL',
    center: { lat: 41.8781, lng: -87.6298 },
    zoom: 11,
    timeZone: 'America/Chicago',
  },
]
