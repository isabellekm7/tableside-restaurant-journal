import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { getBrowserStore } from '../data/keyValueStore'
import type { Child } from '../data/types'
import { sanitizeChildren } from '../lib/profile/children'

export type OnboardingStatus = 'pending' | 'completed' | 'skipped'

interface ProfileData {
  /** 0-4 children. Empty means "no kids added": scoring falls back to a generic family read. */
  children: Child[]
  onboarding: OnboardingStatus
}

interface ProfileActions {
  /** Replace the whole child list (used by the editor). Marks onboarding done. */
  setChildren: (children: Child[]) => void
  skipOnboarding: () => void
  /** Forget everything and show onboarding again (used from /debug). */
  reset: () => void
}

export type ProfileState = ProfileData & ProfileActions

export const PROFILE_STORAGE_KEY = 'tableside.v1.profile'

const initialData: ProfileData = { children: [], onboarding: 'pending' }

const isStatus = (v: unknown): v is OnboardingStatus => v === 'pending' || v === 'completed' || v === 'skipped'

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      ...initialData,
      setChildren: (children) => set({ children: sanitizeChildren(children), onboarding: 'completed' }),
      skipOnboarding: () => set({ onboarding: 'skipped' }),
      reset: () => set({ ...initialData }),
    }),
    {
      name: PROFILE_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => getBrowserStore()),
      partialize: (state): ProfileData => ({ children: state.children, onboarding: state.onboarding }),
      // Never trust stored data: validate it, and fall back to a fresh profile.
      merge: (persisted, current) => {
        const stored = typeof persisted === 'object' && persisted !== null ? (persisted as Record<string, unknown>) : {}
        const children = sanitizeChildren(stored.children)
        const status = isStatus(stored.onboarding) ? stored.onboarding : 'pending'
        return { ...current, children, onboarding: status }
      },
    },
  ),
)
