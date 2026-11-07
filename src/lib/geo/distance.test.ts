import { describe, expect, it } from 'vitest'
import { haversineKm, rideMinutes, travelEstimate, walkMinutes } from './distance'

const portland = { lat: 45.5231, lng: -122.6765 }
const chicago = { lat: 41.8781, lng: -87.6298 }

describe('haversineKm', () => {
  it('is zero for the same point and symmetric', () => {
    expect(haversineKm(portland, portland)).toBe(0)
    expect(haversineKm(portland, chicago)).toBeCloseTo(haversineKm(chicago, portland), 6)
  })

  it('matches known distances', () => {
    expect(haversineKm(portland, chicago)).toBeGreaterThan(2700)
    expect(haversineKm(portland, chicago)).toBeLessThan(2900)
    // 0.01° of latitude is about 1.11 km.
    expect(haversineKm({ lat: 45, lng: -122 }, { lat: 45.01, lng: -122 })).toBeCloseTo(1.11, 1)
  })
})

describe('travelEstimate', () => {
  it('walks when close and rides when far', () => {
    expect(travelEstimate(0.4).mode).toBe('walk')
    expect(travelEstimate(3).mode).toBe('ride')
  })

  it('takes longer the further it is, and never reports zero minutes', () => {
    expect(walkMinutes(0)).toBeGreaterThanOrEqual(1)
    expect(walkMinutes(1)).toBeGreaterThan(walkMinutes(0.5))
    expect(rideMinutes(8)).toBeGreaterThan(rideMinutes(2))
  })
})
