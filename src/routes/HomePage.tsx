import { Palette } from 'lucide-react'
import { ButtonLink } from '../components/ui/Button'
import { usePageTitle } from '../lib/usePageTitle'

/** Placeholder landing screen. Discovery replaces it in Phase 4. */
export function HomePage() {
  usePageTitle('Tableside')
  return (
    <div className="mx-auto w-full max-w-content px-4 py-10">
      <p className="text-small font-semibold tracking-wide text-accent uppercase">Prototype · Phase 1</p>
      <h1 className="mt-2 text-display">Will this work for my kids, right now?</h1>
      <p className="mt-4 text-lead text-text-muted">
        The foundation is in place: design tokens, app shell and routing. Onboarding, scoring and discovery arrive in the
        next phases.
      </p>
      <div className="mt-8">
        <ButtonLink to="/styleguide" variant="secondary" leadingIcon={<Palette size={18} aria-hidden="true" />}>
          Review the styleguide
        </ButtonLink>
      </div>
    </div>
  )
}
