import { Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '../../components/ui/Button'
import { StateMessage } from '../../components/ui/StateMessage'
import { rankInOwnCity } from '../../lib/discovery/rank'
import { useNow } from '../../lib/hooks'
import { useProfileStore } from '../../store/profileStore'
import { RestaurantCard } from '../discovery/RestaurantCard'
import { RestaurantCardSkeletons } from '../discovery/RestaurantCardSkeleton'
import { useListRestaurants } from './useListRestaurants'

export interface ListItemsProps {
  ids: readonly string[]
  /** When given, each place gets a "Remove" button. */
  onRemove?: (restaurantId: string) => void
  emptyText: string
}

/** The places in a list, scored for the viewer's own kids and kept in the order saved. */
export function ListItems({ ids, onRemove, emptyText }: ListItemsProps) {
  const { state, retry } = useListRestaurants(ids)
  const children = useProfileStore((s) => s.children)
  const now = useNow()

  const ranked = useMemo(
    () => (state.status === 'ready' ? rankInOwnCity({ restaurants: state.restaurants, children, cities: state.cities, now }) : []),
    [state, children, now],
  )

  if (state.status === 'loading') return <RestaurantCardSkeletons count={Math.min(Math.max(ids.length, 1), 3)} />
  if (state.status === 'error') {
    return (
      <StateMessage kind="error" title="We couldn’t load these places" action={<Button onClick={retry}>Try again</Button>}>
        Something went wrong on our side.
      </StateMessage>
    )
  }
  if (ids.length === 0) return <p className="rounded-lg border border-dashed border-line-strong p-6 text-center text-text-muted">{emptyText}</p>

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-4" aria-label="Places in this list">
        {ranked.map((item) => (
          <li key={item.restaurant.id}>
            <RestaurantCard
              item={item}
              footerAction={
                onRemove && (
                  <Button variant="ghost" className="relative z-10 -mr-2 print:hidden" leadingIcon={<Trash2 size={18} aria-hidden="true" />} onClick={() => onRemove(item.restaurant.id)} aria-label={`Remove ${item.restaurant.name} from this list`}>
                    Remove
                  </Button>
                )
              }
            />
          </li>
        ))}
      </ul>
      {state.missingIds.length > 0 && (
        <p className="text-small text-text-muted">
          {state.missingIds.length} saved {state.missingIds.length === 1 ? 'place is' : 'places are'} no longer available.
          {onRemove && (
            <Button variant="ghost" onClick={() => state.missingIds.forEach(onRemove)} className="ml-1 inline-flex px-2">
              Clear {state.missingIds.length === 1 ? 'it' : 'them'}
            </Button>
          )}
        </p>
      )}
    </div>
  )
}
