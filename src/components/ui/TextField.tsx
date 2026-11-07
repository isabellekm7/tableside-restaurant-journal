import { CircleAlert } from 'lucide-react'
import { useId, type ComponentPropsWithoutRef } from 'react'
import { cx } from '../../lib/cx'

export interface TextFieldProps extends Omit<ComponentPropsWithoutRef<'input'>, 'id'> {
  label: string
  hint?: string
  error?: string
}

export function TextField({ label, hint, error, className, ...rest }: TextFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-small font-semibold">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(
          'min-h-(--size-touch) w-full rounded-md border bg-surface px-4 text-body placeholder:text-text-subtle',
          'transition-colors duration-(--duration-fast)',
          error ? 'border-2 border-danger' : 'border border-line-strong',
        )}
        {...rest}
      />
      {hint && (
        <p id={hintId} className="text-small text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-small font-medium text-danger">
          <CircleAlert size={16} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}
