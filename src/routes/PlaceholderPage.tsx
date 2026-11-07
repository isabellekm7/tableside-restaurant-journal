import type { ReactNode } from 'react'
import { usePageTitle } from '../lib/usePageTitle'

/** Temporary stand-in for screens built in later phases. */
export function PlaceholderPage({ title, phase, children }: { title: string; phase: number; children?: ReactNode }) {
  usePageTitle(title)
  return (
    <div className="mx-auto w-full max-w-content px-4 py-8">
      <h1 className="text-heading">{title}</h1>
      <p className="mt-2 text-text-muted">This screen is built in Phase {phase}.</p>
      {children}
    </div>
  )
}
