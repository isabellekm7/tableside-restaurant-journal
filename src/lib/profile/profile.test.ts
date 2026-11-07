import { describe, expect, it } from 'vitest'
import type { Child } from '../../data/types'
import { agesForBand } from '../scoring/ageBands'
import { nextChildId, sanitizeChildren } from './children'
import { childShortLabel, chipLabel } from './summary'

describe('chipLabel', () => {
  it('matches the brief’s example', () => {
    const kids: Child[] = [
      { id: 'child-1', band: 'toddler', ageYears: 2 },
      { id: 'child-2', band: 'preschool', ageYears: 5 },
    ]
    expect(chipLabel(kids)).toBe('2 kids: 2y, 5y')
  })

  it('singularises, and falls back to the band when no exact age was given', () => {
    expect(chipLabel([{ id: 'a', band: 'toddler' }])).toBe('1 kid: toddler')
    expect(chipLabel([{ id: 'a', band: 'schoolAge' }, { id: 'b', band: 'infant' }])).toBe('2 kids: school-age, infant')
  })

  it('invites the user to add kids when there are none', () => {
    expect(chipLabel([])).toBe('Add your kids')
  })

  it('shows "<1y" for an exact age of zero', () => {
    expect(childShortLabel({ id: 'a', band: 'infant', ageYears: 0 })).toBe('<1y')
  })
})

describe('sanitizeChildren', () => {
  it('keeps valid children and exact ages that match their band', () => {
    expect(sanitizeChildren([{ id: 'a', band: 'toddler', ageYears: 2 }, { id: 'b', band: 'infant' }])).toEqual([
      { id: 'a', band: 'toddler', ageYears: 2 },
      { id: 'b', band: 'infant' },
    ])
  })

  it('drops an exact age that contradicts the band, keeping the band', () => {
    expect(sanitizeChildren([{ id: 'a', band: 'toddler', ageYears: 9 }])).toEqual([{ id: 'a', band: 'toddler' }])
  })

  it.each([undefined, null, 'x', 5, {}, [null], [{}], [{ id: '', band: 'toddler' }], [{ id: 'a', band: 'adult' }]])(
    'rejects junk: %j',
    (junk) => {
      expect(sanitizeChildren(junk)).toEqual([])
    },
  )

  it('removes duplicate ids and caps at 4', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, band: 'toddler' }))
    expect(sanitizeChildren(many)).toHaveLength(4)
    expect(sanitizeChildren([{ id: 'a', band: 'toddler' }, { id: 'a', band: 'infant' }])).toHaveLength(1)
  })
})

describe('nextChildId and agesForBand', () => {
  it('picks the lowest unused id', () => {
    expect(nextChildId([])).toBe('child-1')
    expect(nextChildId(['child-1', 'child-3'])).toBe('child-2')
  })

  it('lists whole-year ages per band', () => {
    expect(agesForBand('infant')).toEqual([0])
    expect(agesForBand('toddler')).toEqual([1, 2])
    expect(agesForBand('preschool')).toEqual([3, 4, 5])
    expect(agesForBand('schoolAge')).toEqual([6, 7, 8, 9, 10, 11, 12])
  })
})
