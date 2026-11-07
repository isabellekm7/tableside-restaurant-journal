import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { getBrowserStore } from '../data/keyValueStore'
import type { CityId, LatLng } from '../data/types'
import { DEFAULT_FILTERS, type Filters, type SortMode } from '../lib/discovery/filters'

/** Where distances are measured from. */
export type Origin = { kind: 'city' } | { kind: 'geo'; point: LatLng }

export type ResultsView = 'list' | 'map'

interface DiscoveryData {
  cityId: CityId
  origin: Origin
  filters: Filters
  sort: SortMode
  search: string
  /** The restaurant highlighted in both the list and on the map. */
  selectedId: string | null
  /** Phone-only toggle; on wide screens both are always shown. */
  view: ResultsView
}

interface DiscoveryActions {
  /** Switching city resets the origin and selection. */
  setCity: (cityId: CityId) => void
  setOrigin: (origin: Origin) => void
  patchFilters: (patch: Partial<Filters>) => void
  clearFilters: () => void
  setSort: (sort: SortMode) => void
  setSearch: (search: string) => void
  select: (id: string | null) => void
  setView: (view: ResultsView) => void
}

export type DiscoveryState = DiscoveryData & DiscoveryActions

export const DISCOVERY_STORAGE_KEY = 'tableside.v1.discovery'
export const DEFAULT_CITY: CityId = 'portland'

export const initialDiscoveryData: DiscoveryData = {
  cityId: DEFAULT_CITY,
  origin: { kind: 'city' },
  filters: DEFAULT_FILTERS,
  sort: 'fit',
  search: '',
  selectedId: null,
  view: 'list',
}

const isCityId = (v: unknown): v is CityId => v === 'portland' || v === 'chicago'

/**
 * Only the chosen city persists. Filters, search and location reset on reload so
 * a returning (or next test) user starts from a clean slate, and no location is stored.
 */
export const useDiscoveryStore = create<DiscoveryState>()(
  persist(
    (set) => ({
      ...initialDiscoveryData,
      setCity: (cityId) => set({ cityId, origin: { kind: 'city' }, selectedId: null }),
      setOrigin: (origin) => set({ origin }),
      patchFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch }, selectedId: null })),
      clearFilters: () => set({ filters: DEFAULT_FILTERS, selectedId: null }),
      setSort: (sort) => set({ sort }),
      setSearch: (search) => set({ search, selectedId: null }),
      select: (selectedId) => set({ selectedId }),
      setView: (view) => set({ view }),
    }),
    {
      name: DISCOVERY_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => getBrowserStore()),
      partialize: (state) => ({ cityId: state.cityId }),
      merge: (persisted, current) => {
        const stored = typeof persisted === 'object' && persisted !== null ? (persisted as Record<string, unknown>) : {}
        return { ...current, cityId: isCityId(stored.cityId) ? stored.cityId : DEFAULT_CITY }
      },
    },
  ),
)
