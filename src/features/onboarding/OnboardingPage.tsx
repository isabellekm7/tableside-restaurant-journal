import { Lock } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { SampleDataStrip } from '../../components/layout/SampleDataStrip'
import { Wordmark } from '../../components/layout/Wordmark'
import { Button } from '../../components/ui/Button'
import { usePageTitle } from '../../lib/usePageTitle'
import { useProfileStore } from '../../store/profileStore'
import { useProfileActions } from '../profile/useProfileActions'
import { ChildProfileForm } from './ChildProfileForm'

/** Where to go after onboarding: the page the gate bounced the user from, else home. */
function returnPath(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state) {
    const from = (state as { from: unknown }).from
    if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('/welcome')) return from
  }
  return '/'
}

/** First launch: "Who's eating?". Skippable; kids can be edited later from the header chip. */
export function OnboardingPage() {
  usePageTitle('Who’s eating?')
  const navigate = useNavigate()
  const location = useLocation()
  const children = useProfileStore((s) => s.children)
  const { saveChildren, skip } = useProfileActions()
  const to = returnPath(location.state)

  return (
    <div className="flex min-h-dvh flex-col">
      <header>
        <SampleDataStrip />
        <div className="mx-auto w-full max-w-content px-4 pt-6">
          <Wordmark />
        </div>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-4 py-6">
        <div>
          <h1 className="text-display">Who’s eating?</h1>
          <p className="mt-2 text-lead text-text-muted">
            We’ll show how well each restaurant works for your kids’ ages. It takes a few seconds, and you can change it
            any time.
          </p>
        </div>

        <ChildProfileForm
          initialChildren={children}
          submitLabel="Find restaurants"
          childHeadingLevel={2}
          onSubmit={(kids) => {
            saveChildren(kids, 'onboarding')
            navigate(to, { replace: true })
          }}
          secondaryActions={
            <Button
              variant="ghost"
              onClick={() => {
                skip()
                navigate(to, { replace: true })
              }}
            >
              Skip for now
            </Button>
          }
        />

        <p className="flex items-start gap-2 text-small text-text-muted">
          <Lock size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          Ages stay on this device. Skipping shows a general family fit until you add them.
        </p>
      </main>
    </div>
  )
}
