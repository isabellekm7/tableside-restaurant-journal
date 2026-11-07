import { describe, expect, it } from 'vitest'
import { SEED_RESTAURANTS } from '../../data/seed'
import { breakdownForBand, formatAttributeValue } from './breakdown'

const byId = (id: string) => {
  const r = SEED_RESTAURANTS.find((x) => x.id === id)
  if (!r) throw new Error(`missing ${id}`)
  return r
}

describe('breakdownForBand', () => {
  const fern = byId('pdx-little-fern-kitchen')

  it('lists only what matters for the band, most important first', () => {
    const toddler = breakdownForBand(fern.attributes, 'toddler')
    expect(toddler[0]).toMatchObject({ key: 'highChairs', importance: 'high', status: 'good', value: '5', phrase: '5 high chairs' })
    const keys = toddler.map((r) => r.key)
    expect(keys).toContain('foodSpeed')
    expect(keys).not.toContain('nearbyPark') // irrelevant for toddlers
    expect(breakdownForBand(fern.attributes, 'preschool').map((r) => r.key)).not.toContain('highChairs')
  })

  it('explains good and poor rows in words, and leaves middling ones to speak for themselves', () => {
    const rows = Object.fromEntries(breakdownForBand(fern.attributes, 'infant').map((r) => [r.key, r]))
    expect(rows.changingTable).toMatchObject({ status: 'poor', value: 'No', phrase: 'no changing table' })
    expect(rows.staffWelcome).toMatchObject({ status: 'good', value: 'Warm' })
    const tinderbox = breakdownForBand(byId('pdx-tinderbox-pizza-yard').attributes, 'toddler')
    expect(tinderbox.find((r) => r.key === 'foodSpeed')).toMatchObject({ status: 'okay', value: 'Moderate', phrase: null })
  })

  it('shows gaps honestly instead of hiding them', () => {
    const rows = breakdownForBand(fern.attributes, 'infant')
    const nursing = rows.find((r) => r.key === 'nursingFriendly')
    expect(nursing).toMatchObject({ status: 'unknown', value: null, phrase: null, confirmationCount: null, lastConfirmedAt: null })
  })

  it('carries provenance for each reported fact', () => {
    const row = breakdownForBand(fern.attributes, 'toddler').find((r) => r.key === 'highChairs')
    expect(row).toMatchObject({ confirmationCount: 31, lastConfirmedAt: '2026-10-11' })
  })

  it('judges noise per band', () => {
    const noisy = byId('chi-ironwood-smokehouse').attributes
    const infant = breakdownForBand(noisy, 'infant').find((r) => r.key === 'noiseLevel')
    const toddler = breakdownForBand(noisy, 'toddler').find((r) => r.key === 'noiseLevel')
    expect(infant?.status).toBe('poor')
    expect(toddler?.status).toBe('good')
  })

  it('has a generic breakdown for families without a profile', () => {
    expect(breakdownForBand(fern.attributes, 'generic').length).toBeGreaterThan(0)
  })
})

describe('formatAttributeValue', () => {
  it('formats numbers, booleans and words', () => {
    expect(formatAttributeValue(4)).toBe('4')
    expect(formatAttributeValue(true)).toBe('Yes')
    expect(formatAttributeValue(false)).toBe('No')
    expect(formatAttributeValue('loud')).toBe('Loud')
  })
})
