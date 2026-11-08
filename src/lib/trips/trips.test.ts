import { describe, expect, it } from 'vitest'
import type { TripList } from '../../data/types'
import { buildShareUrl, parseShareParams } from '../share/shareLink'
import { DEFAULT_LIST_NAME, MAX_LIST_NAME, MAX_LIST_SIZE, addToList, isSaved, newTripList, removeFromList, sanitizeListName, uniqueListName } from './lists'

const NOW = new Date('2026-11-07T19:00:00Z')
const list = (ids: string[] = []): TripList => newTripList('l1', 'Weekend', NOW, ids)

describe('list names', () => {
  it('trims, collapses whitespace, caps length, and never returns an empty name', () => {
    expect(sanitizeListName('  Weekend   in\nPortland ')).toBe('Weekend in Portland')
    expect(sanitizeListName('x'.repeat(200))).toHaveLength(MAX_LIST_NAME)
    expect(sanitizeListName('   ')).toBe(DEFAULT_LIST_NAME)
    expect(sanitizeListName('', 'Fallback')).toBe('Fallback')
  })

  it('numbers duplicates, ignoring case', () => {
    expect(uniqueListName([], 'Weekend')).toBe('Weekend')
    expect(uniqueListName(['Weekend'], 'weekend')).toBe('weekend 2')
    expect(uniqueListName(['Weekend', 'Weekend 2'], 'Weekend')).toBe('Weekend 3')
  })

  it('keeps a numbered name within the length cap', () => {
    const long = 'y'.repeat(MAX_LIST_NAME)
    expect(uniqueListName([long], long).length).toBeLessThanOrEqual(MAX_LIST_NAME)
  })
})

describe('list operations', () => {
  it('adds once, removes cleanly, and reports membership', () => {
    const added = addToList(list(), 'a')
    expect(added).toMatchObject({ changed: true, full: false })
    expect(addToList(added.list, 'a')).toMatchObject({ changed: false })
    expect(isSaved(added.list, 'a')).toBe(true)
    expect(removeFromList(added.list, 'a').restaurantIds).toEqual([])
    expect(removeFromList(added.list, 'zzz')).toBe(added.list)
    expect(isSaved(undefined, 'a')).toBe(false)
  })

  it('stops at the size the database allows, so saving never fails late', () => {
    const full = list(Array.from({ length: MAX_LIST_SIZE }, (_, i) => `r${i}`))
    expect(addToList(full, 'one-more')).toMatchObject({ changed: false, full: true })
  })

  it('does not mutate the list it was given', () => {
    const original = list(['a'])
    const before = JSON.stringify(original)
    addToList(original, 'b')
    removeFromList(original, 'a')
    expect(JSON.stringify(original)).toBe(before)
  })

  it('builds a list with the creation time on both stamps and a capped size', () => {
    const l = newTripList('x', '  Trip ', NOW, Array.from({ length: 150 }, (_, i) => `r${i}`))
    expect(l).toMatchObject({ id: 'x', name: 'Trip', createdAt: NOW.toISOString(), updatedAt: NOW.toISOString() })
    expect(l.restaurantIds).toHaveLength(MAX_LIST_SIZE)
  })
})

describe('share links', () => {
  const origin = 'https://app.example'

  it('round-trips a list through a URL', () => {
    const url = buildShareUrl(origin, { name: 'Weekend & more', restaurantIds: ['pdx-little-fern-kitchen', 'chi-saffron-table'] })
    expect(url.startsWith(`${origin}/shared?`)).toBe(true)
    expect(parseShareParams(new URL(url).search)).toEqual({ name: 'Weekend & more', restaurantIds: ['pdx-little-fern-kitchen', 'chi-saffron-table'] })
  })

  it('contains only the list name and place ids', () => {
    const url = new URL(buildShareUrl(origin, { name: 'Trip', restaurantIds: ['a'] }))
    expect([...url.searchParams.keys()].sort()).toEqual(['n', 'r'])
  })

  it('rejects links with nothing usable in them', () => {
    expect(parseShareParams('')).toBeNull()
    expect(parseShareParams('?n=Trip')).toBeNull()
    expect(parseShareParams('?r=')).toBeNull()
  })

  it('drops junk ids (anything that is not a plain slug) and duplicates', () => {
    const parsed = parseShareParams('?n=T&r=good-id,<script>alert(1)</script>,../../etc,good-id,UPPER,ok2')
    expect(parsed?.restaurantIds).toEqual(['good-id', 'ok2'])
  })

  it('cleans and caps the name, and defaults it', () => {
    expect(parseShareParams(`?n=${encodeURIComponent('   spaced   out   ')}&r=a`)?.name).toBe('spaced out')
    expect(parseShareParams(`?n=${'x'.repeat(500)}&r=a`)?.name.length).toBeLessThanOrEqual(MAX_LIST_NAME)
    expect(parseShareParams('?r=a')?.name).toBe('Shared trip')
  })

  it('caps the number of places', () => {
    const ids = Array.from({ length: 300 }, (_, i) => `r${i}`).join(',')
    expect(parseShareParams(`?r=${ids}`)?.restaurantIds).toHaveLength(MAX_LIST_SIZE)
  })
})
