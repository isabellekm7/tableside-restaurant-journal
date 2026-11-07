import { describe, expect, it } from 'vitest'
import {
  addDraft,
  canAddDraft,
  childrenFromDrafts,
  draftsFromChildren,
  isComplete,
  removeDraft,
  setAge,
  setBand,
} from './draft'

describe('draft helpers', () => {
  it('starts with one blank row when there are no children', () => {
    const drafts = draftsFromChildren([])
    expect(drafts).toEqual([{ key: 'child-1', band: null, ageYears: null }])
    expect(isComplete(drafts)).toBe(false)
  })

  it('keeps existing child ids so edits do not change identities', () => {
    const drafts = draftsFromChildren([{ id: 'child-7', band: 'toddler', ageYears: 2 }])
    expect(childrenFromDrafts(drafts)).toEqual([{ id: 'child-7', band: 'toddler', ageYears: 2 }])
  })

  it('adds rows up to four, with unique ids', () => {
    let drafts = draftsFromChildren([])
    while (canAddDraft(drafts)) drafts = addDraft(drafts)
    expect(drafts).toHaveLength(4)
    expect(new Set(drafts.map((d) => d.key)).size).toBe(4)
    expect(addDraft(drafts)).toHaveLength(4)
  })

  it('never removes the last remaining row', () => {
    const one = draftsFromChildren([])
    expect(removeDraft(one, 'child-1')).toHaveLength(1)
    const two = addDraft(one)
    expect(removeDraft(two, 'child-1').map((d) => d.key)).toEqual(['child-2'])
  })

  it('setAge also sets the band', () => {
    const [draft] = setAge(draftsFromChildren([]), 'child-1', 4)
    expect(draft).toMatchObject({ band: 'preschool', ageYears: 4 })
  })

  it('setBand keeps an exact age only if it still fits the band', () => {
    const withAge = setAge(draftsFromChildren([]), 'child-1', 2)
    expect(setBand(withAge, 'child-1', 'toddler')[0]?.ageYears).toBe(2)
    expect(setBand(withAge, 'child-1', 'preschool')[0]).toMatchObject({ band: 'preschool', ageYears: null })
  })

  it('only converts complete rows into children', () => {
    const drafts = addDraft(setBand(draftsFromChildren([]), 'child-1', 'infant'))
    expect(isComplete(drafts)).toBe(false)
    expect(childrenFromDrafts(drafts)).toEqual([{ id: 'child-1', band: 'infant' }])
  })
})
