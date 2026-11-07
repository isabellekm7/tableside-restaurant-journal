import { create } from 'zustand'

/** Transient UI state (not persisted). */
interface UiState {
  profileSheetOpen: boolean
  openProfileSheet: () => void
  closeProfileSheet: () => void
}

export const useUiStore = create<UiState>()((set) => ({
  profileSheetOpen: false,
  openProfileSheet: () => set({ profileSheetOpen: true }),
  closeProfileSheet: () => set({ profileSheetOpen: false }),
}))
