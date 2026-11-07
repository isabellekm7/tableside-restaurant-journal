import { ButtonLink } from '../components/ui/Button'
import { StateMessage } from '../components/ui/StateMessage'
import { usePageTitle } from '../lib/usePageTitle'

export function NotFoundPage() {
  usePageTitle('Page not found')
  return (
    <StateMessage
      kind="empty"
      title="We can't find that page"
      action={<ButtonLink to="/">Back to Explore</ButtonLink>}
    >
      The link may be old or mistyped.
    </StateMessage>
  )
}
