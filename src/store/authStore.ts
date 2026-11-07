import { create } from 'zustand'
import { auth, type AccountUser, type AuthService } from '../data'

interface AuthStoreState {
  /** The auth backend. Swappable so tests can inject a fake. */
  service: AuthService
  /** The signed-in ACCOUNT, or null. Anonymous sessions don't count as accounts. */
  user: AccountUser | null
  /** False until the first session check finishes, so the UI doesn't flash "signed out". */
  ready: boolean
  /** True while the user is following a password-reset link and must choose a new password. */
  recovering: boolean
  /** Start listening. Returns the unsubscribe function. */
  init: () => () => void
  finishRecovery: () => void
}

const asAccount = (user: AccountUser | null): AccountUser | null => (user && !user.isAnonymous ? user : null)

export const useAuthStore = create<AuthStoreState>()((set, get) => ({
  service: auth,
  user: null,
  ready: false,
  recovering: false,

  init: () => {
    const { service } = get()
    let active = true
    void service.getUser().then((user) => {
      if (active) set({ user: asAccount(user), ready: true })
    })
    const unsubscribe = service.onChange(({ user, event }) => {
      if (!active) return
      set((s) => ({
        user: asAccount(user),
        ready: true,
        recovering: event === 'password_recovery' ? true : event === 'signed_out' ? false : s.recovering,
      }))
    })
    return () => {
      active = false
      unsubscribe()
    }
  },

  finishRecovery: () => set({ recovering: false }),
}))
