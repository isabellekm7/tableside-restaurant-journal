import type { ComponentPropsWithoutRef, ElementType } from 'react'
import { cx } from '../../lib/cx'

export interface CardProps extends ComponentPropsWithoutRef<'div'> {
  /** Semantic element to render. Use "article" for list items with their own heading. */
  as?: 'div' | 'article' | 'section' | 'li'
  padding?: 'none' | 'md' | 'lg'
  /** Highlighted as the current selection (list ↔ map sync). */
  selected?: boolean
  /** Adds hover/press feedback for cards that act as a single target. */
  interactive?: boolean
}

const paddings = { none: '', md: 'p-4', lg: 'p-6' } as const

export function Card({
  as = 'div',
  padding = 'md',
  selected = false,
  interactive = false,
  className,
  ...rest
}: CardProps) {
  // The `as` union is limited to block-level tags that accept div-like props.
  // Asserting (not annotating) stops TS narrowing back to the literal union.
  const Tag = as as ElementType
  return (
    <Tag
      className={cx(
        'rounded-lg border bg-surface shadow-card',
        paddings[padding],
        selected ? 'border-primary ring-2 ring-primary' : 'border-line',
        interactive &&
          'transition-[box-shadow,transform] duration-(--duration-base) ease-out hover:shadow-raised motion-safe:active:scale-[0.995]',
        className,
      )}
      {...rest}
    />
  )
}
