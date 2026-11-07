import { ChevronDown } from 'lucide-react'
import { useId, type ComponentPropsWithoutRef } from 'react'
import { cx } from '../../lib/cx'

export interface SelectFieldProps extends Omit<ComponentPropsWithoutRef<'select'>, 'id'> {
  label: string
  hint?: string
}

/** Native select (best mobile picker) with the same label/hint pattern as TextField. */
export function SelectField({ label, hint, className, children, ...rest }: SelectFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-small font-semibold">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-describedby={hint ? hintId : undefined}
          className="min-h-(--size-touch) w-full appearance-none rounded-md border border-line-strong bg-surface pr-10 pl-4 text-body"
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-muted"
        />
      </div>
      {hint && (
        <p id={hintId} className="text-small text-text-muted">
          {hint}
        </p>
      )}
    </div>
  )
}
