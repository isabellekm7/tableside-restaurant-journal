import { Printer, Share2 } from 'lucide-react'
import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Button, ButtonLink } from '../../components/ui/Button'
import { StateMessage } from '../../components/ui/StateMessage'
import { parseShareParams } from '../../lib/share/shareLink'
import { usePageTitle } from '../../lib/usePageTitle'
import { useTripStore } from '../../store/tripStore'
import { ListItems } from './ListItems'

/** /shared?n=…&r=…: a read-only, print-friendly summary from a share link, scored for the VIEWER's kids. */
export function SharedListPage() {
  const { search } = useLocation()
  const navigate = useNavigate()
  const createList = useTripStore((s) => s.createList)
  const shared = useMemo(() => parseShareParams(search), [search])
  usePageTitle(shared ? shared.name : 'Shared list')

  if (!shared) {
    return (
      <StateMessage kind="empty" title="This link doesn’t have a list in it" action={<ButtonLink to="/">Find a restaurant</ButtonLink>}>
        It may have been cut off when it was copied. Ask for the link again.
      </StateMessage>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-5 px-4 py-6">
      <div>
        <p className="flex items-center gap-1.5 text-small font-semibold tracking-wide text-accent uppercase print:hidden">
          <Share2 size={14} aria-hidden="true" /> Shared with you
        </p>
        <h1 className="text-display">{shared.name}</h1>
        <p className="mt-1 text-text-muted">
          {shared.restaurantIds.length} {shared.restaurantIds.length === 1 ? 'place' : 'places'}. Fit is shown for <em>your</em> kids.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button
          onClick={async () => {
            await createList(shared.name, shared.restaurantIds)
            navigate('/saved')
          }}
        >
          Save a copy to my lists
        </Button>
        <Button variant="secondary" leadingIcon={<Printer size={18} aria-hidden="true" />} onClick={() => window.print()}>
          Print
        </Button>
      </div>

      <ListItems ids={shared.restaurantIds} emptyText="This list is empty." />
      <p className="hidden text-small text-text-muted print:block">Sample data: the restaurants in this list are fictional. Printed from Tableside.</p>
    </div>
  )
}
