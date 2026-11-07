import { Palette, Users } from 'lucide-react'
import { Button, ButtonLink } from '../components/ui/Button'
import { FamilyFitPreview } from '../features/preview/FamilyFitPreview'
import { usePageTitle } from '../lib/usePageTitle'
import { useProfileStore } from '../store/profileStore'
import { useUiStore } from '../store/uiStore'

/** Placeholder landing screen. Discovery replaces it in Phase 4. */
export function HomePage() {
  usePageTitle('Tableside')
  const hasKids = useProfileStore((s) => s.children.length > 0)
  const openProfile = useUiStore((s) => s.openProfileSheet)

  return (
    <div className="mx-auto w-full max-w-wide px-4 py-8">
      <p className="text-small font-semibold tracking-wide text-accent uppercase">Prototype · Phase 3</p>
      <h1 className="mt-2 max-w-content text-display">Will this work for my kids, right now?</h1>
      <p className="mt-4 max-w-content text-lead text-text-muted">
        Below, six sample places scored for your family. Change your kids from the header and watch the fit move.
        Discovery, map and “Right now” arrive in the next phases.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        {!hasKids && (
          <Button leadingIcon={<Users size={18} aria-hidden="true" />} onClick={openProfile}>
            Add your kids
          </Button>
        )}
        <ButtonLink to="/styleguide" variant="secondary" leadingIcon={<Palette size={18} aria-hidden="true" />}>
          Review the styleguide
        </ButtonLink>
      </div>

      <section aria-labelledby="preview-title" className="mt-10">
        <h2 id="preview-title" className="text-heading">
          How sample places fit {hasKids ? 'your family' : 'families in general'}
        </h2>
        <p className="mt-1 mb-5 text-small text-text-muted">Temporary preview, replaced by Discovery in Phase 4.</p>
        <FamilyFitPreview />
      </section>
    </div>
  )
}
