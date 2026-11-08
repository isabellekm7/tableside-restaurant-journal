import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { IconButton } from './Button'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/**
 * Modal sheet: slides up from the bottom on phones, centres on wider screens.
 * Built on the native <dialog>, which gives us focus trapping, an inert
 * background, and Esc-to-close without extra code. Children mount only while
 * open, so forms start fresh each time.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Stop the page behind from scrolling while the sheet is open.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Esc fires `cancel` immediately, but the browser delivers `close` as a later queued task.
      // Listening to both keeps our state in step with the dialog, so an instant re-open is never swallowed.
      onCancel={onClose}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (e.target === e.currentTarget) onClose()
      }}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-xl bg-surface p-0 text-text shadow-sheet backdrop:bg-overlay open:animate-sheet-in md:m-auto md:max-w-lg md:rounded-xl"
    >
      {open && (
        <div className="flex flex-col gap-4 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-heading">
              {title}
            </h2>
            <IconButton label="Close" icon={<X size={22} aria-hidden="true" />} onClick={onClose} className="-mt-1 -mr-2" />
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
