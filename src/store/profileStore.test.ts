import { describe, expect, it } from 'vitest'
import type { Child } from '../data/types'
import { PROFILE_STORAGE_KEY, useProfileStore } from './profileStore'

const toddler: Child = { id: 'child-1', band: 'toddler', ageYears: 2 }
const preschooler: Child = { id: 'child-2', band: 'preschool', ageYears: 5 }

describe('profile store', () => {
  it('starts with no kids and onboarding pending', () => {
    const { children, onboarding } = useProfileStore.getState()
    expect(children).toEqual([])
    expect(onboarding).toBe('pending')
  })

  it('setChildren saves kids and completes onboarding', () => {
    useProfileStore.getState().setChildren([toddler, preschooler])
    const state = useProfileStore.getState()
    expect(state.children).toEqual([toddler, preschooler])
    expect(state.onboarding).toBe('completed')
  })

  it('treats an empty list as a valid choice ("no kids")', () => {
    useProfileStore.getState().setChildren([])
    expect(useProfileStore.getState().onboarding).toBe('completed')
  })

  it('never stores more than 4 children or invalid ones', () => {
    const five: Child[] = Array.from({ length: 5 }, (_, i) => ({ id: `child-${i + 1}`, band: 'toddler' as const }))
    useProfileStore.getState().setChildren(five)
    expect(useProfileStore.getState().children).toHaveLength(4)
  })

  it('skipping leaves the kids empty', () => {
    useProfileStore.getState().skipOnboarding()
    const state = useProfileStore.getState()
    expect(state.onboarding).toBe('skipped')
    expect(state.children).toEqual([])
  })

  it('reset returns to a first-run state', () => {
    useProfileStore.getState().setChildren([toddler])
    useProfileStore.getState().reset()
    expect(useProfileStore.getState()).toMatchObject({ children: [], onboarding: 'pending' })
  })
})

describe('persistence', () => {
  it('writes to localStorage', () => {
    useProfileStore.getState().setChildren([toddler])
    const stored: unknown = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) ?? 'null')
    expect(stored).toMatchObject({ state: { children: [toddler], onboarding: 'completed' } })
  })

  it('restores a saved profile on startup', async () => {
    localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({ state: { children: [toddler, preschooler], onboarding: 'completed' }, version: 1 }),
    )
    await useProfileStore.persist.rehydrate()
    expect(useProfileStore.getState().children).toEqual([toddler, preschooler])
    expect(useProfileStore.getState().onboarding).toBe('completed')
  })

  it('shrugs off corrupt stored data and starts fresh', async () => {
    localStorage.setItem(PROFILE_STORAGE_KEY, '{definitely not json')
    await useProfileStore.persist.rehydrate()
    expect(useProfileStore.getState()).toMatchObject({ children: [], onboarding: 'pending' })
  })

  it('drops invalid children and unknown statuses from edited storage', async () => {
    localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({
        state: {
          children: [toddler, { id: 'x', band: 'teenager' }, 'nope', { id: 'child-1', band: 'infant' }],
          onboarding: 'whatever',
        },
        version: 1,
      }),
    )
    await useProfileStore.persist.rehydrate()
    expect(useProfileStore.getState().children).toEqual([toddler]) // bad band, junk and duplicate id removed
    expect(useProfileStore.getState().onboarding).toBe('pending')
  })
})
