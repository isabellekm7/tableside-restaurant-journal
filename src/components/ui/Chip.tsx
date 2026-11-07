import { Check } from 'lucide-react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cx } from '../../lib/cx'

export interface ChipProps extends ComponentPropsWithoutRef<'button'> {
  selected?: boolean
  /** Shown when not selected. When selected a check mark replaces it. */
  icon?: ReactNode
}

/** A toggle chip for filters. State is conveyed by a check mark, not colour alone. */
export function Chip({ selected = false, icon, className, children, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(
        'inline-flex min-h-(--size-touch) items-center gap-1.5 rounded-pill border-2 px-4 text-small font-medium',
        'transition-colors duration-(--duration-fast) ease-out motion-safe:active:scale-[0.98]',
        selected
          ? 'border-primary bg-primary-soft text-primary'
          : 'border-line-strong bg-surface text-text hover:bg-surface-sunken',
        className,
      )}
      {...rest}
    >
      {selected ? <Check size={16} strokeWidth={2.5} aria-hidden="true" /> : icon}
      {children}
    </button>
  )
}
