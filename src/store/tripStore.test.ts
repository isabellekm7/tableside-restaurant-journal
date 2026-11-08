import { describe, expect, it, vi } from 'vitest'
import { repository } from '../data'
import { DEFAULT_LIST_NAME } from '../lib/trips/lists'
import { ACTIVE_LIST_KEY, useTripStore } from './tripStore'

const store = () => useTripStore.getState()

describe('tripStore', () => {
  it('starts empty and loads without error', async () => {
    await store().load()
    expect(store()).toMatchObject({ lists: [], loaded: true, activeListId: null, error: null })
  })

  it('the first save quietly creates "My trip" and saves into it', async () => {
    await store().load()
    expect(await store().toggleSaved('pdx-velvet-ladle')).toBe('saved')
    expect(store().lists).toHaveLength(1)
    expect(store().lists[0]).toMatchObject({ name: DEFAULT_LIST_NAME, restaurantIds: ['pdx-velvet-ladle'] })
    expect(store().activeListId).toBe(store().lists[0]?.id)
  })

  it('tapping again removes it', async () => {
    await store().toggleSaved('a')
    expect(await store().toggleSaved('a')).toBe('removed')
    expect(store().lists[0]?.restaurantIds).toEqual([])
  })

  it('persists to the device, and a fresh load sees it (offline-first)', async () => {
    await store().toggleSaved('a')
    await store().toggleSaved('b')
    useTripStore.setState({ lists: [], loaded: false })
    await store().load()
    expect(store().lists[0]?.restaurantIds).toEqual(['a', 'b'])
    expect((await repository.listTripLists())[0]?.restaurantIds).toEqual(['a', 'b'])
  })

  it('remembers which list is active across visits', async () => {
    const first = await store().createList('Portland')
    const second = await store().createList('Chicago')
    store().setActive(first.id)
    expect(localStorage.getItem(ACTIVE_LIST_KEY)).toBe(first.id)
    useTripStore.setState({ lists: [], loaded: false, activeListId: localStorage.getItem(ACTIVE_LIST_KEY) })
    await store().load()
    expect(store().activeListId).toBe(first.id)
    expect(store().lists.map((l) => l.id)).toContain(second.id)
  })

  it('falls back to the first list if the remembered one is gone', async () => {
    const only = await store().createList('Only')
    useTripStore.setState({ lists: [], loaded: false, activeListId: 'deleted-long-ago' })
    await store().load()
    expect(store().activeListId).toBe(only.id)
  })

  it('creates lists with unique names and makes the newest active', async () => {
    await store().createList('Weekend')
    const second = await store().createList('weekend')
    expect(second.name).toBe('weekend 2')
    expect(store().activeListId).toBe(second.id)
  })

  it('renames (keeping names unique), removes places, and deletes lists', async () => {
    const a = await store().createList('A')
    await store().createList('B', ['x', 'y'])
    await store().renameList(a.id, 'b')
    expect(store().lists.find((l) => l.id === a.id)?.name).toBe('b 2')

    const bList = store().lists.find((l) => l.name === 'B')
    await store().removeFromList(bList?.id ?? '', 'x')
    expect(store().lists.find((l) => l.name === 'B')?.restaurantIds).toEqual(['y'])

    await store().deleteList(a.id)
    expect(store().lists.map((l) => l.name)).toEqual(['B'])
    expect(store().activeListId).toBe(store().lists[0]?.id)
  })

  it('can create a list pre-filled with places (used by "Save a copy" on a shared link)', async () => {
    const list = await store().createList('Shared', ['a', 'b'])
    expect(list.restaurantIds).toEqual(['a', 'b'])
  })

  it('rolls back and reports when saving fails', async () => {
    await store().toggleSaved('a')
    vi.spyOn(repository, 'saveTripList').mockRejectedValueOnce(new Error('disk full'))
    expect(await store().toggleSaved('b')).toBe('failed')
    expect(store().lists[0]?.restaurantIds).toEqual(['a']) // the screen did not keep a place that was not saved
    expect(store().error).toMatch(/couldn’t save/)
  })

  it('refuses to overfill a list', async () => {
    const list = await store().createList('Big', Array.from({ length: 100 }, (_, i) => `r${i}`))
    store().setActive(list.id)
    expect(await store().toggleSaved('one-more')).toBe('full')
    expect(store().error).toMatch(/up to 100/)
  })
})
