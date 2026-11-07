import { CircleAlert, Eye, EyeOff } from 'lucide-react'
import { useId, useState, type ComponentPropsWithoutRef } from 'react'
import { cx } from '../../lib/cx'

export interface PasswordFieldProps extends Omit<ComponentPropsWithoutRef<'input'>, 'id' | 'type'> {
  label: string
  hint?: string
  error?: string
}

/** Password input with a show/hide toggle (kind to small touchscreen keyboards). */
export function PasswordField({ label, hint, error, className, ...rest }: PasswordFieldProps) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-small font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoCapitalize="none"
          spellCheck={false}
          className={cx(
            'min-h-(--size-touch) w-full rounded-md border bg-surface pr-14 pl-4 text-body',
            error ? 'border-2 border-danger' : 'border border-line-strong',
          )}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute top-0 right-0 flex size-(--size-touch) items-center justify-center rounded-md text-text-muted hover:text-text"
        >
          {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-small text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-small font-medium text-danger">
          <CircleAlert size={16} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}
