import { Link, Outlet } from 'react-router'
import { SampleDataTag } from '../ui/SampleDataTag'
import { PrimaryNav } from './PrimaryNav'
import { Wordmark } from './Wordmark'

/** Landmarks: banner, primary navigation, main. Bottom nav on phones, header nav from md up. */
export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only rounded-pill bg-primary px-4 py-2 font-semibold text-on-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex min-h-14 w-full max-w-wide items-center gap-3 px-4">
          <Link to="/" aria-label="Tableside home" className="rounded-md">
            <Wordmark />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <SampleDataTag />
            <PrimaryNav variant="header" />
          </div>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="flex-1 pb-[calc(var(--size-touch-lg)+env(safe-area-inset-bottom)+1rem)] focus:outline-none md:pb-0"
      >
        <Outlet />
      </main>

      <PrimaryNav variant="bottom" />
    </div>
  )
}
