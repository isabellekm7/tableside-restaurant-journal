import { Check, CircleCheck, CircleHelp, CircleX, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { FIT_LEVEL_LABEL, type FitLevel } from '../../lib/fit'
import { fitBadgeClass } from './fitStyles'

const icons: Record<FitLevel, ReactNode> = {
  great: <CircleCheck size={16} aria-hidden="true" />,
  good: <Check size={16} strokeWidth={2.5} aria-hidden="true" />,
  mixed: <TriangleAlert size={16} aria-hidden="true" />,
  poor: <CircleX size={16} aria-hidden="true" />,
  unknown: <CircleHelp size={16} aria-hidden="true" />,
}

export interface FitBadgeProps {
  level: FitLevel
  /** Override the default wording, e.g. "Great for toddlers". */
  label?: string
  /** Optional 0-100 score shown after the label. */
  score?: number
  size?: 'sm' | 'md'
  className?: string
}

/** Kid-fit result: always an icon + words (+ optional number), never colour alone. */
export function FitBadge({ level, label, score, size = 'md', className }: FitBadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-pill font-semibold whitespace-nowrap',
        size === 'md' ? 'px-3 py-1.5 text-small' : 'px-2.5 py-1 text-caption',
        fitBadgeClass[level],
        className,
      )}
    >
      {icons[level]}
      <span>{label ?? FIT_LEVEL_LABEL[level]}</span>
      {score !== undefined && <span className="font-medium tabular-nums opacity-90">· {Math.round(score)}</span>}
    </span>
  )
}
