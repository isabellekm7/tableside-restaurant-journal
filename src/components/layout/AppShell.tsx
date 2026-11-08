import { useEffect } from 'react'
import { Link, Navigate, Outlet, ScrollRestoration, useLocation } from 'react-router'
import { ProfileChip } from '../../features/profile/ProfileChip'
import { ProfileSheet } from '../../features/profile/ProfileSheet'
import { useAuthStore } from '../../store/authStore'
import { useTripStore } from '../../store/tripStore'
import { useProfileStore } from '../../store/profileStore'
import { OfflineBanner } from './OfflineBanner'
import { PrimaryNav } from './PrimaryNav'
import { SampleDataStrip } from './SampleDataStrip'
import { Wordmark } from './Wordmark'

/** Internal screens that never wait for onboarding. */
const GATE_EXEMPT = ['/styleguide', '/debug']

/**
 * Landmarks: banner, primary navigation, main. Bottom nav on phones, header nav from md up.
 * First launch (onboarding still pending) redirects to /welcome, remembering where the user was going.
 */
export function AppShell() {
  const onboarding = useProfileStore((s) => s.onboarding)
  const { pathname } = useLocation()
  const initAuth = useAuthStore((s) => s.init)
  const accountId = useAuthStore((s) => s.user?.id)
  const loadTrips = useTripStore((s) => s.load)

  // Restore any saved session and follow sign-in / sign-out / password-recovery events.
  useEffect(() => initAuth(), [initAuth])

  // Load saved lists on start, and again when the signed-in account changes (their lists differ).
  useEffect(() => {
    void loadTrips()
  }, [loadTrips, accountId])

  if (onboarding === 'pending' && !GATE_EXEMPT.includes(pathname)) {
    return <Navigate to="/welcome" replace state={{ from: pathname }} />
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="print:hidden sr-only rounded-pill bg-primary font-semibold text-on-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      <header className="print:hidden sticky top-0 z-20 border-b border-line bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <SampleDataStrip />
        <div className="mx-auto flex min-h-14 w-full max-w-wide items-center gap-3 px-4">
          <Link to="/" aria-label="Tableside home" className="inline-flex min-h-(--size-touch) min-w-(--size-touch) shrink-0 items-center rounded-md">
            <Wordmark collapseOnPhone />
          </Link>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <PrimaryNav variant="header" />
            <ProfileChip />
          </div>
        </div>
      </header>

      <OfflineBanner />

      <main
        id="main"
        tabIndex={-1}
        className="flex-1 pb-[calc(var(--size-touch-lg)+env(safe-area-inset-bottom)+1rem)] focus:outline-none md:pb-0"
      >
        <Outlet />
      </main>

      <PrimaryNav variant="bottom" />
      <ProfileSheet />
      <ScrollRestoration />
    </div>
  )
}
