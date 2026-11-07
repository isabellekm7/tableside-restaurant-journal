import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { ChildProfileForm } from '../onboarding/ChildProfileForm'
import { useProfileStore } from '../../store/profileStore'
import { useUiStore } from '../../store/uiStore'
import { useProfileActions } from './useProfileActions'

/** The header chip's editor: same form as onboarding, in a sheet. */
export function ProfileSheet() {
  const open = useUiStore((s) => s.profileSheetOpen)
  const close = useUiStore((s) => s.closeProfileSheet)
  const children = useProfileStore((s) => s.children)
  const { saveChildren } = useProfileActions()

  return (
    <Sheet open={open} onClose={close} title="Who’s eating?">
      <p className="-mt-2 text-text-muted">Kid-fit scores update for these ages.</p>
      <ChildProfileForm
        initialChildren={children}
        submitLabel="Save"
        stickyActions
        onSubmit={(kids) => {
          saveChildren(kids, 'header')
          close()
        }}
        secondaryActions={
          children.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => {
                saveChildren([], 'header')
                close()
              }}
            >
              Remove all kids
            </Button>
          )
        }
      />
    </Sheet>
  )
}
