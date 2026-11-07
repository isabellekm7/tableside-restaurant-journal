import { Users } from 'lucide-react'
import { chipLabel } from '../../lib/profile/summary'
import { useProfileStore } from '../../store/profileStore'
import { useUiStore } from '../../store/uiStore'

/** Persistent header control: shows who we're scoring for and opens the editor. */
export function ProfileChip() {
  const children = useProfileStore((s) => s.children)
  const open = useUiStore((s) => s.openProfileSheet)
  return (
    <button
      type="button"
      onClick={open}
      aria-haspopup="dialog"
      className="inline-flex min-h-(--size-touch) max-w-full min-w-0 items-center gap-2 rounded-pill border-2 border-primary bg-primary-soft px-3.5 text-small font-semibold text-primary transition-colors duration-(--duration-fast) hover:bg-fit-great-bg motion-safe:active:scale-[0.98]"
    >
      <Users size={18} aria-hidden="true" className="shrink-0" />
      <span className="truncate">{chipLabel(children)}</span>
      <span className="sr-only">, change who’s eating</span>
    </button>
  )
}
