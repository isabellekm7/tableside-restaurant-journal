import { create } from 'zustand'
import { repository, type TripList } from '../data'
import { MAX_LIST_SIZE, addToList, newTripList, removeFromList, sanitizeListName, uniqueListName, DEFAULT_LIST_NAME } from '../lib/trips/lists'

export const ACTIVE_LIST_KEY = 'tableside.v1.activeList'

function readActive(): string | null {
  try {
    return localStorage.getItem(ACTIVE_LIST_KEY)
  } catch {
    return null
  }
}
function writeActive(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_LIST_KEY, id)
    else localStorage.removeItem(ACTIVE_LIST_KEY)
  } catch {
    // Storage blocked: the active list simply resets next visit.
  }
}

const makeId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export type SaveOutcome = 'saved' | 'removed' | 'full' | 'failed'

interface TripState {
  lists: TripList[]
  /** False until the first load finishes (so the UI doesn't flash "nothing saved"). */
  loaded: boolean
  /** New saves go here. */
  activeListId: string | null
  error: string | null
  load: () => Promise<void>
  toggleSaved: (restaurantId: string) => Promise<SaveOutcome>
  createList: (name: string, restaurantIds?: readonly string[]) => Promise<TripList>
  renameList: (id: string, name: string) => Promise<void>
  deleteList: (id: string) => Promise<void>
  removeFromList: (listId: string, restaurantId: string) => Promise<void>
  setActive: (id: string) => void
}

/**
 * Trip lists are saved on the device first (so they work offline) and synced to the
 * account when one is signed in; that is the repository's job. Every change updates
 * the screen immediately and rolls back if saving fails.
 */
export const useTripStore = create<TripState>()((set, get) => {
  const persist = async (list: TripList, previous: TripList[]): Promise<boolean> => {
    try {
      const saved = await repository.saveTripList(list)
      set((s) => ({ lists: s.lists.map((l) => (l.id === saved.id ? saved : l)), error: null }))
      return true
    } catch {
      set({ lists: previous, error: 'We couldn’t save that change. Please try again.' })
      return false
    }
  }

  return {
    lists: [],
    loaded: false,
    activeListId: readActive(),
    error: null,

    async load() {
      try {
        const lists = await repository.listTripLists()
        const active = get().activeListId
        const activeListId = active && lists.some((l) => l.id === active) ? active : (lists[0]?.id ?? null)
        writeActive(activeListId)
        set({ lists, loaded: true, activeListId, error: null })
      } catch {
        set({ loaded: true, error: 'We couldn’t load your lists.' })
      }
    },

    async createList(name, restaurantIds = []) {
      const previous = get().lists
      const list = newTripList(makeId(), uniqueListName(previous.map((l) => l.name), name), new Date(), restaurantIds)
      set({ lists: [...previous, list], activeListId: list.id })
      writeActive(list.id)
      await persist(list, previous)
      return get().lists.find((l) => l.id === list.id) ?? list
    },

    async toggleSaved(restaurantId) {
      let active = get().lists.find((l) => l.id === get().activeListId)
      if (!active) active = await get().createList(DEFAULT_LIST_NAME)
      const previous = get().lists
      const isSavedNow = active.restaurantIds.includes(restaurantId)
      const { list: next, full } = isSavedNow ? { list: removeFromList(active, restaurantId), full: false } : addToList(active, restaurantId)
      if (full) {
        set({ error: `A list can hold up to ${MAX_LIST_SIZE} places.` })
        return 'full'
      }
      set({ lists: previous.map((l) => (l.id === next.id ? next : l)) })
      return (await persist(next, previous)) ? (isSavedNow ? 'removed' : 'saved') : 'failed'
    },

    async renameList(id, name) {
      const previous = get().lists
      const target = previous.find((l) => l.id === id)
      if (!target) return
      const others = previous.filter((l) => l.id !== id).map((l) => l.name)
      const next = { ...target, name: uniqueListName(others, sanitizeListName(name, target.name)) }
      set({ lists: previous.map((l) => (l.id === id ? next : l)) })
      await persist(next, previous)
    },

    async removeFromList(listId, restaurantId) {
      const previous = get().lists
      const target = previous.find((l) => l.id === listId)
      if (!target) return
      const next = removeFromList(target, restaurantId)
      set({ lists: previous.map((l) => (l.id === listId ? next : l)) })
      await persist(next, previous)
    },

    async deleteList(id) {
      const previous = get().lists
      const remaining = previous.filter((l) => l.id !== id)
      const activeListId = get().activeListId === id ? (remaining[0]?.id ?? null) : get().activeListId
      writeActive(activeListId)
      set({ lists: remaining, activeListId })
      try {
        await repository.deleteTripList(id)
      } catch {
        set({ lists: previous, error: 'We couldn’t delete that list. Please try again.' })
      }
    },

    setActive(id) {
      writeActive(id)
      set({ activeListId: id })
    },
  }
})
