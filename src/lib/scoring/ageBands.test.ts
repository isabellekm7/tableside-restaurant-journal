import { describe, expect, it } from 'vitest'
import { bandForAge, childFromAge, childFromBand, describeChild } from './ageBands'

describe('bandForAge (by completed years)', () => {
  it.each([
    [0, 'infant'],
    [1, 'toddler'],
    [2, 'toddler'],
    [3, 'preschool'],
    [5, 'preschool'],
    [6, 'schoolAge'],
    [12, 'schoolAge'],
  ] as const)('age %i is %s', (age, band) => {
    expect(bandForAge(age)).toBe(band)
  })

  it.each([-1, 13, 2.5, Number.NaN])('rejects unsupported age %s', (age) => {
    expect(() => bandForAge(age)).toThrow(RangeError)
  })
})

describe('describeChild', () => {
  it('uses the exact age when known', () => {
    expect(describeChild(childFromAge('a', 2))).toBe('2-year-old')
    expect(describeChild(childFromAge('a', 11))).toBe('11-year-old')
  })

  it('calls a child under one a baby, never "0-year-old"', () => {
    expect(describeChild(childFromAge('a', 0))).toBe('baby')
  })

  it('falls back to the band noun when only a band was chosen', () => {
    expect(describeChild(childFromBand('a', 'toddler'))).toBe('toddler')
    expect(describeChild(childFromBand('a', 'preschool'))).toBe('preschooler')
    expect(describeChild(childFromBand('a', 'schoolAge'))).toBe('school-age child')
  })
})
