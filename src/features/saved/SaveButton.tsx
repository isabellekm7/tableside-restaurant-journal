import { Bookmark, BookmarkCheck } from 'lucide-react'
import { useState } from 'react'
import { Button, IconButton } from '../../components/ui/Button'
import { track } from '../../lib/analytics/logger'
import { DEFAULT_LIST_NAME, isSaved } from '../../lib/trips/lists'
import { useTripStore, type SaveOutcome } from '../../store/tripStore'

export interface SaveButtonProps {
  restaurantId: string
  restaurantName: string
  variant?: 'icon' | 'button'
  className?: string
}

const ANNOUNCE: Record<SaveOutcome, (list: string) => string> = {
  saved: (list) => `Saved to ${list}.`,
  removed: (list) => `Removed from ${list}.`,
  full: () => 'That list is full.',
  failed: () => 'We couldn’t save that. Please try again.',
}

/** Save to the active trip list with one tap. Works offline: lists live on the device first. */
export function SaveButton({ restaurantId, restaurantName, variant = 'icon', className }: SaveButtonProps) {
  const active = useTripStore((s) => s.lists.find((l) => l.id === s.activeListId))
  const toggleSaved = useTripStore((s) => s.toggleSaved)
  const [message, setMessage] = useState('')
  const saved = isSaved(active, restaurantId)
  const listName = active?.name ?? DEFAULT_LIST_NAME

  const onClick = async () => {
    const outcome = await toggleSaved(restaurantId)
    if (outcome === 'saved') track({ type: 'list_saved', restaurantId })
    setMessage(ANNOUNCE[outcome](useTripStore.getState().lists.find((l) => l.id === useTripStore.getState().activeListId)?.name ?? DEFAULT_LIST_NAME))
  }

  const label = saved ? `Saved. Remove ${restaurantName} from ${listName}` : `Save ${restaurantName} to ${listName}`
  const Icon = saved ? BookmarkCheck : Bookmark

  return (
    <>
      {variant === 'icon' ? (
        <IconButton
          label={label}
          aria-pressed={saved}
          onClick={onClick}
          className={className}
          icon={<Icon size={22} aria-hidden="true" className={saved ? 'text-primary' : undefined} />}
        />
      ) : (
        <Button variant={saved ? 'primary' : 'secondary'} aria-label={label} aria-pressed={saved} leadingIcon={<Icon size={18} aria-hidden="true" />} onClick={onClick} className={className}>
          {saved ? 'Saved' : 'Save'}
        </Button>
      )}
      <span role="status" className="sr-only">
        {message}
      </span>
    </>
  )
}
