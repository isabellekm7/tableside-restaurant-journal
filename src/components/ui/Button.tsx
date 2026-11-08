import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cx } from '../../lib/cx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent'
export type ButtonSize = 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-pill font-semibold ' +
  'transition-[background-color,transform] duration-(--duration-fast) ease-out ' +
  'motion-safe:active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  secondary: 'border-2 border-primary bg-transparent text-primary hover:bg-primary-soft',
  ghost: 'text-primary hover:bg-primary-soft',
  accent: 'bg-accent text-on-accent hover:bg-clay-700',
}

const sizes: Record<ButtonSize, string> = {
  md: 'min-h-(--size-touch) px-5 text-body',
  lg: 'min-h-(--size-touch-lg) px-6 text-lead',
}

interface ButtonStyleProps {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  leadingIcon?: ReactNode
}

function buttonClass({ variant = 'primary', size = 'md', fullWidth = false }: ButtonStyleProps, extra?: string) {
  return cx(base, variants[variant], sizes[size], fullWidth && 'w-full', extra)
}

export interface ButtonProps extends ComponentPropsWithoutRef<'button'>, ButtonStyleProps {}

export function Button({
  variant,
  size,
  fullWidth,
  leadingIcon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, fullWidth }, className)}
      {...rest}
    >
      {leadingIcon}
      {children}
    </button>
  )
}

export interface ButtonLinkProps extends LinkProps, ButtonStyleProps {}

/** A real link that looks like a button (navigation, not an action). */
export function ButtonLink({ variant, size, fullWidth, leadingIcon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass({ variant, size, fullWidth }, className)} {...rest}>
      {leadingIcon}
      {children}
    </Link>
  )
}

export interface IconButtonProps extends Omit<ComponentPropsWithoutRef<'button'>, 'aria-label'> {
  /** Required: icon-only buttons need an accessible name. */
  label: string
  icon: ReactNode
}

export function IconButton({ label, icon, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cx(
        'inline-flex size-(--size-touch) shrink-0 items-center justify-center rounded-pill text-text-muted',
        'transition-colors duration-(--duration-fast) hover:bg-surface-sunken hover:text-text',
        'motion-safe:active:scale-95 disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  )
}
